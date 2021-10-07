import {compileTsTypes, ITsTypesCompilerOptions, RefResolver} from './ts-types-compiler';
import {parseJtdDefinitions} from './jtd-ast';
import {IJtdcDialectConfig, IJtdDict, IJtdRefNode, JtdcDialectFactory} from '@jtdc/types';
import {createMap, die} from './misc';
import {compileValidators, IValidatorCompilerOptions} from './validators-compiler';
import {compileJsSource} from '@smikhalevski/codegen';
import {pascalCase} from 'change-case-all';

export interface ITsModulesCompilerOptions<M, C>
    extends ITsTypesCompilerOptions<M>,
            IValidatorCompilerOptions<M, C>,
            Partial<IJtdcDialectConfig<M>> {

  /**
   * The callback that produces the validator compilation dialect.
   */
  dialectFactory: JtdcDialectFactory<M, C>;

  /**
   * Returns a module that exports a referenced type.
   */
  resolveImport(node: IJtdRefNode<M>, fromModule: ITsModule, modules: Array<ITsModule>): ITsModule;

  /**
   * Returns the relative import path.
   */
  resolveImportPath(fromModule: ITsModule, toModule: ITsModule): string;

  /**
   * If `true` then validator functions are rendered along with types.
   */
  validatorsRendered?: boolean;
}

export const enum TsModuleExportKind {
  TYPE = 'type',
  TYPE_GUARD = 'typeGuard',
  VALIDATOR = 'validator',
}

/**
 * The TypeScript module.
 */
export interface ITsModule {

  /**
   * The module path as it was provided to the compiler.
   */
  path: string;

  /**
   * The compiled source code of the module.
   */
  source: string;

  /**
   * Map from an exported ref to a map of export names by kind.
   */
  exports: {
    [ref: string]: {
      [Kind in TsModuleExportKind]?: string;
    };
  };
}

/**
 * Compiles map of JTD definitions to a map of corresponding sources.
 *
 * @template M The type of the metadata.
 * @template C The type of the context.
 *
 * @param jtdModules The map from module URI to JTD definitions map.
 * @param dialectFactory
 * @param tsModuleRefResolver Returns a module that contains a ref definition or throws.
 * @param options Compiler options.
 */
export function compileTsModules<M, C>(jtdModules: Record</*uri*/string, IJtdDict<M>>, options?: ITsModulesCompilerOptions<M, C>): Array<ITsModule> {
  options = {
    ...dialectConfig,
    ...options,
  };

  const {
    renameType,
    renameValidator,
    validatorsRendered,
    dialectFactory,
  } = opts;

  const dialect = dialectFactory(options);
  const tsModules = createMap<ITsModule>();

  // Resolve exports
  for (const [path, jtdDefinitions] of Object.entries(jtdModules)) {

    const definitions = parseJtdDefinitions(jtdDefinitions);
    const exports = createMap<Record<TsModuleExportKind, string>>();

    for (const [ref, node] of Object.entries(definitions)) {
      exports[ref] = {
        type: renameType(ref, node),
      };
    }

    tsModules[path] = {
      source: '',
      definitions,
      exports,
      imports: {},
    };
  }


  const tsModuleEntries = entries(tsModules);

  const refResolver: RefResolver<M> = (node) => {
    const ref = node.ref;

    let exportName;
    let exportUri;

    for (const [uri, tsModule] of tsModuleEntries) {
      const typeName = tsModule.exports[ref];

      if (typeName == null) {
        continue;
      }
      if (exportUri != null) {
        die(`Ambiguous reference to "${typeName}" between`);
      }
      exportName = typeName;

      const refs = tsModule.imports[uri] ||= [];

      if (!refs.includes(ref)) {
        refs.push(ref);
      }
    }

    return exportName || die('Unresolved reference: ' + ref);
  };

  for (const [, tsModule] of tsModuleEntries) {
    let src = compileTsTypes(tsModule.definitions, refResolver, options);

    // Assemble imports
    for (const [uri, refs] of entries(tsModule.imports)) {
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

    // Compile validators
    if (validatorsRendered && dialect != null) {
      src = compileJsSource(dialect.import()) + src;
      src += compileValidators(tsModule.definitions, dialect, options);
    }

    tsModule.source = src;
  }

  return tsModules;
}

/**
 * Global default options used by {@link createJtdDialect}.
 */
export const dialectConfig: IJtdcDialectConfig<any> = {
  renameValidator: (ref) => 'validate' + pascalCase(ref),
  renamePropertyKey: (propKey) => propKey,
  renameDiscriminatorKey: (node) => node.discriminator,
  rewriteEnumValue: (value) => value,
  rewriteMappingKey: (mappingKey) => mappingKey,
  renameTypeGuard: (ref) => 'is' + pascalCase(ref),
  renameType: (ref) => pascalCase(ref),
};
