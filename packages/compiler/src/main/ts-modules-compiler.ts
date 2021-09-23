import {compileTsTypes, ITsTypesCompilerOptions, tsTypesCompilerOptions} from './ts-types-compiler';
import {parseJtdDefinitions} from './jtd-ast';
import {IJtd, IJtdcDialect, IJtdcDialectOptions, JtdNode} from '@jtdc/types';
import {createMap, die} from './misc';
import {compileValidators, IValidatorCompilerOptions, validatorCompilerOptions} from './validators-compiler';
import {compileJsSource} from '@smikhalevski/codegen';
import {createJtdDialect, jtdDialectOptions} from '@jtdc/jtd-dialect';

export interface ITsModulesCompilerOptions<M, C>
    extends Omit<ITsTypesCompilerOptions<M>, 'resolveExternalRef'>,
            Omit<IValidatorCompilerOptions<M, C>, 'dialect'>,
            IJtdcDialectOptions<M> {

  /**
   * If `true` then validator functions are rendered along with types.
   */
  validatorsRendered?: boolean;

  /**
   * The callback that produces the validator compilation dialect.
   */
  dialectFactory?: (options?: IJtdcDialectOptions<M>) => IJtdcDialect<M, C>;
}

/**
 * Compiles map of JTD definitions to a map of corresponding sources.
 *
 * @template M The type of the metadata.
 * @template C The type of the context.
 *
 * @param jtdModules The map from module URI to JTD definitions map.
 * @param options Compiler options.
 */
export function compileTsModules<M, C>(jtdModules: Record<string, Record<string, IJtd<M>>>, options?: ITsModulesCompilerOptions<M, C>): Record<string, string> {

  const opts = {
    ...validatorCompilerOptions,
    ...tsTypesCompilerOptions,
    ...jtdDialectOptions,
    ...options,
  };

  const {
    validatorsRendered,
    dialectFactory = createJtdDialect,
  } = opts;

  const dialect = dialectFactory(opts);
  const tsModules = createMap<string>();

  const modules = Object.entries(jtdModules).map(([uri, jtdDefinitions]) => {
    const definitions = parseJtdDefinitions(jtdDefinitions);
    const exports = extractExports(definitions, opts);
    return {uri, definitions, exports};
  });

  for (const module of modules) {
    const imports = createMap<Set<string>>();

    opts.resolveExternalRef = (node) => {
      for (const module of modules) {
        const exportedRef = module.exports[node.ref];
        if (exportedRef) {
          const importedNames = imports[module.uri] ||= new Set();

          importedNames.add(exportedRef.typeName);

          if (validatorsRendered) {
            importedNames.add(exportedRef.validatorName);
          }
          return exportedRef.typeName;
        }
      }
      die('Unresolved reference: ' + node.ref);
    };

    let src = compileTsTypes(module.definitions, opts);

    for (const [uri, importedNames] of Object.entries(imports)) {
      src = `import{${Array.from(importedNames).sort().join(',')}}from${JSON.stringify(uri)};` + src;
    }

    if (validatorsRendered && dialect != null) {
      src = compileJsSource(dialect.import()) + src;
      src += compileValidators(module.definitions, opts);
    }

    tsModules[module.uri] = src;
  }

  return tsModules;
}

interface IExport<M> {
  typeName: string;
  validatorName: string;
}

function extractExports<M>(definitions: Record<string, JtdNode<M>>, options: Required<IJtdcDialectOptions<M>>): Record<string, IExport<M>> {
  const exports: Record<string, IExport<M>> = createMap();

  for (const [ref, node] of Object.entries(definitions)) {
    exports[ref] = {
      typeName: options.renameType(ref, node),
      validatorName: options.renameValidator(ref, node),
    };
  }
  return exports;
}
