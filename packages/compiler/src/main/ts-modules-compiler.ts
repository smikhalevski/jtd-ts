import {compileTsTypes, ITsTypesCompilerOptions, RefResolver} from './ts-types-compiler';
import {parseJtdDefinitions} from './jtd-ast';
import {IJtd, IJtdcDialect, IJtdcDialectOptions, JtdcDialectFactory, JtdNode} from '@jtdc/types';
import {createMap, die} from './misc';
import {compileValidators, IValidatorCompilerOptions} from './validators-compiler';
import {compileJsSource} from '@smikhalevski/codegen';
import {pascalCase} from 'change-case-all';

export interface ITsModulesCompilerOptions<M, C>
    extends ITsTypesCompilerOptions<M>,
            IValidatorCompilerOptions<M, C>,
            IJtdcDialectOptions<M> {

  /**
   * If `true` then validator functions are rendered along with types.
   */
  validatorsRendered?: boolean;
}

export interface ITsModule<M> {

  /**
   * The module source code.
   */
  source: string;

  definitions: Record<string, JtdNode<M>>;

  /**
   * Map from exported ref to a TS type name.
   */
  exports: Record<string, string>;

  /**
   * Map from an URI of an imported module to an imported ref.
   */
  imports: Record<string, Array<string>>;
}

/**
 * Compiles map of JTD definitions to a map of corresponding sources.
 *
 * @template M The type of the metadata.
 * @template C The type of the context.
 *
 * @param jtdModules The map from module URI to JTD definitions map.
 * @param dialectFactory The callback that produces the validator compilation dialect.
 * @param options Compiler options.
 */
export function compileTsModules<M, C>(jtdModules: Record<string, Record<string, IJtd<M>>>, dialectFactory: JtdcDialectFactory<M, C>, options: ITsModulesCompilerOptions<M, C> = {}): Record<string, ITsModule<M>> {

  const {
    renameType = (ref) => pascalCase(ref),
    renameValidator = (ref) => 'validate' + pascalCase(ref),
    validatorsRendered,
  } = options;

  const dialect: IJtdcDialect<any, any> = dialectFactory(options);
  const tsModules = createMap<ITsModule<M>>();

  // Resolve module exports
  for (const [uri, jtdDefinitions] of Object.entries(jtdModules)) {

    const definitions = parseJtdDefinitions(jtdDefinitions);
    const exports = createMap<string>();

    for (const [ref, node] of Object.entries(definitions)) {
      exports[ref] = renameType(ref, node);
    }

    tsModules[uri] = {
      source: '',
      definitions,
      exports,
      imports: {},
    };
  }

  const tsModuleEntries = Object.entries(tsModules);

  for (const [, tsModule] of tsModuleEntries) {

    const resolveExternalRef: RefResolver<M> = (node) => {
      const ref = node.ref;

      for (const [uri, otherTsModule] of tsModuleEntries) {
        if (tsModule === otherTsModule) {
          continue;
        }

        const typeNode = otherTsModule.definitions[ref];

        if (!typeNode) {
          continue;
        }

        const refs = tsModule.imports[uri] ||= [];

        if (refs.indexOf(ref) === -1) {
          refs.push(ref);
        }
        return otherTsModule.exports[ref];
      }
      die('Unresolved reference: ' + ref);
    };

    let src = compileTsTypes(tsModule.definitions, resolveExternalRef, options);

    for (const [uri, refs] of Object.entries(tsModule.imports)) {
      const importedNames: Array<string> = [];

      for (const ref of refs) {

        const node = tsModules[uri].definitions[ref];

        importedNames.push(renameType(ref, node));

        if (validatorsRendered) {
          importedNames.push(renameValidator(ref, node));
        }
      }

      importedNames.sort();

      src = `import{${importedNames.join(',')}}from${JSON.stringify(uri)};` + src;
    }

    if (validatorsRendered && dialect != null) {
      src = compileJsSource(dialect.import()) + src;
      src += compileValidators(tsModule.definitions, dialect, options);
    }

    tsModule.source = src;
  }

  return tsModules;
}
