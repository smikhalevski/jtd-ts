import {compileTsTypes, ITsTypesCompilerOptions, RefResolver, tsTypesCompilerOptions} from './ts-types-compiler';
import {parseJtdDefinitions} from './jtd-ast';
import {IJtdcDialectConfig, IJtdDict, IJtdNodeDict, IJtdRefNode, JtdcDialectFactory, JtdNodeType} from '@jtdc/types';
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
   * Returns a ref and module that exports a referenced type.
   */
  resolveImportedRef(node: IJtdRefNode<M>, originTsModule: ITsModule, tsModules: Array<ITsModule>): [ref: string, tsModule: ITsModule];

  /**
   * Returns a relative import path.
   */
  resolveImportPath(importedTsModule: ITsModule, tsModule: ITsModule): string;

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
   * The module path.
   */
  path: string;

  /**
   * Parsed definitions contained by the module.
   */
  definitions: IJtdNodeDict<any>;

  /**
   * The compiled TypeScript source code of the module.
   */
  source: string;

  /**
   * Map from a ref to a map of export names by kind.
   */
  exports: Record<string, Record<TsModuleExportKind, string>>;
}

/**
 * Compiles map of JTD definitions to a map of corresponding sources.
 *
 * @template M The type of the metadata.
 * @template C The type of the context.
 */
export function compileTsModules<M, C>(jtdModules: Record<string, IJtdDict<M>>, options: ITsModulesCompilerOptions<M, C>): Array<ITsModule> {

  const resolvedOptions: Required<ITsModulesCompilerOptions<M, C>> = {
    validatorsRendered: false,
    typeGuardsRendered: false,
    ...tsTypesCompilerOptions,
    ...dialectConfig,
    ...options,
  };

  const {
    renameValidator,
    renameTypeGuard,
    validatorsRendered,
    dialectFactory,
    resolveImportedRef,
    resolveImportPath,
  } = resolvedOptions;

  const dialect = dialectFactory(resolvedOptions);
  const tsModules = createTsModules(jtdModules, resolvedOptions);

  for (const tsModule of tsModules) {

    const imports = new Map<ITsModule, Array<string>>();

    const refResolver: RefResolver<M> = (node) => {
      const [ref, importedTsModule] = resolveImportedRef(node, tsModule, tsModules);

      if (tsModule !== importedTsModule) {
        imports.get(importedTsModule)?.push(ref) || imports.set(importedTsModule, [ref]);
      }
      return importedTsModule.exports[ref][TsModuleExportKind.TYPE];
    };

    // Compile types
    let src = compileTsTypes(tsModule.definitions, refResolver, resolvedOptions);

    // Assemble imports
    let importsSrc = '';
    imports.forEach((refs, importedTsModule) => {
      const importedNames: Array<string> = [];

      for (const ref of refs) {
        importedNames.push(importedTsModule.exports[ref][TsModuleExportKind.TYPE]);

        if (validatorsRendered) {
          importedNames.push(importedTsModule.exports[ref][TsModuleExportKind.VALIDATOR]);
        }
      }
      importsSrc += `import{${importedNames.sort().join(',')}}from${JSON.stringify(resolveImportPath(importedTsModule, tsModule))};`;
    });

    src = importsSrc + src;

    // Compile validators
    if (validatorsRendered) {

      resolvedOptions.renameValidator = (ref, node) => {
        if (node.nodeType === JtdNodeType.REF) {
          const [ref, importedTsModule] = resolveImportedRef(node, tsModule, tsModules);
          return importedTsModule.exports[ref][TsModuleExportKind.VALIDATOR];
        }
        return renameValidator(ref, node);
      };

      resolvedOptions.renameTypeGuard = (ref, node) => {
        if (node.nodeType === JtdNodeType.REF) {
          const [ref, importedTsModule] = resolveImportedRef(node, tsModule, tsModules);
          return importedTsModule.exports[ref][TsModuleExportKind.TYPE_GUARD];
        }
        return renameTypeGuard(ref, node);
      };

      src = compileJsSource(dialect.import())
          + src
          + compileValidators(tsModule.definitions, dialect, resolvedOptions);
    }

    tsModule.source = src;
  }

  return tsModules;
}

function createTsModules<M>(jtdModules: Record<string, IJtdDict<M>>, options: Required<ITsModulesCompilerOptions<M, unknown>>): Array<ITsModule> {

  const {
    renameValidator,
    renameType,
    renameTypeGuard,
  } = options;

  const tsModules: Array<ITsModule> = [];

  for (const [path, jtdDefinitions] of Object.entries(jtdModules)) {

    const definitions = parseJtdDefinitions(jtdDefinitions);
    const tsModule: ITsModule = {
      path,
      definitions,
      source: '',
      exports: createMap(),
    };

    for (const [ref, node] of Object.entries(definitions)) {
      tsModule.exports[ref] = {
        [TsModuleExportKind.TYPE]: renameType(ref, node),
        [TsModuleExportKind.VALIDATOR]: renameValidator(ref, node),
        [TsModuleExportKind.TYPE_GUARD]: renameTypeGuard(ref, node),
      };
    }

    tsModules.push(tsModule);
  }

  return tsModules;
}

/**
 * The default dialect config.
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
