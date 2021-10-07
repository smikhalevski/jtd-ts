import {compileTypes, ITypesCompilerOptions, RefResolver, typesCompilerOptions} from './types-compiler';
import {parseJtdDefinitions} from './jtd-ast';
import {IValidatorDialectConfig, IJtdDict, IJtdNodeDict, IJtdRefNode, ValidatorDialectFactory, JtdNodeType} from '@jtdc/types';
import {createMap, die} from './misc';
import {compileValidators, IValidatorCompilerOptions, validatorDialectConfig} from './validators-compiler';
import {compileJsSource} from '@smikhalevski/codegen';

export interface ITsModulesCompilerOptions<M, C>
    extends ITypesCompilerOptions<M>,
            IValidatorCompilerOptions<M, C>,
            Partial<IValidatorDialectConfig<M>> {

  /**
   * Returns the module and the definition name referenced by node.
   */
  resolveImportRef(node: IJtdRefNode<M>, nodeModule: ITsModule, modules: Array<ITsModule>): [importedModule: ITsModule, name: string];

  /**
   * Returns a relative import path.
   */
  resolveImportPath(importedModule: ITsModule, module: ITsModule): string;

  /**
   * The callback that produces the validator compilation dialect.
   */
  dialectFactory?: ValidatorDialectFactory<M, C>;

  /**
   * If `true` then validator functions are rendered along with types.
   */
  validatorsRendered?: boolean;
}









































/**
 * The TypeScript module.
 */
export interface ITsModule {

  /**
   * The path of the JTD module from which this TypeScript module was derived.
   */
  jtdPath: string;

  /**
   * Parsed definitions from the JTD module.
   */
  definitions: IJtdNodeDict<any>;

  /**
   * The compiled TypeScript source code of the module.
   */
  source: string;

  /**
   * Map from the definition name to a map of corresponding exports.
   */
  exports: Record<string, ITsModuleExport>;
}

export interface ITsModuleExport {
  typeName: string;
  validatorName: string;
  typeGuardName: string;
}

/**
 * Compiles map of JTD definitions to a map of corresponding sources.
 *
 * @template M The type of the JTD metadata.
 * @template C The type of the context.
 */
export function compileTsModules<M, C>(jtdModules: Record<string, IJtdDict<M>>, options: ITsModulesCompilerOptions<M, C>): Array<ITsModule> {

  const resolvedOptions: Required<ITsModulesCompilerOptions<M, C>> = {
    validatorsRendered: false,
    typeGuardsRendered: false,
    dialectFactory: () => die('Cannot compile validators and type guards without validatorDialectFactory'),
    ...typesCompilerOptions,
    ...validatorDialectConfig,
    ...options,
  };

  const modules = createTsModules(jtdModules, resolvedOptions);

  for (const module of modules) {
    compileTsModule(module, modules, resolvedOptions);
  }

  return modules;
}

function compileTsModule<M>(module: ITsModule, modules: Array<ITsModule>, options: Required<ITsModulesCompilerOptions<M, unknown>>): void {

  const {
    renameValidator,
    renameTypeGuard,
    validatorsRendered,
    dialectFactory,
    resolveImportRef,
    resolveImportPath,
  } = options;

  const imports = new Map<ITsModule, Array<string>>();

  const refResolver: RefResolver<M> = (node) => {
    const [importedModule, name] = resolveImportRef(node, module, modules);

    if (module.jtdPath !== importedModule.jtdPath) {
      imports.get(importedModule)?.push(name) || imports.set(importedModule, [name]);
    }
    return importedModule.exports[name].typeName;
  };

  let src = compileTypes(module.definitions, refResolver, options);
  let importsSrc = '';

  imports.forEach((names, importedModule) => {
    const tsNames: Array<string> = [];

    for (const name of names) {
      tsNames.push(importedModule.exports[name].typeName);

      if (validatorsRendered) {
        tsNames.push(importedModule.exports[name].validatorName);
      }
    }
    importsSrc += `import{${tsNames.sort().join(',')}}from${JSON.stringify(resolveImportPath(importedModule, module))};`;
  });

  src = importsSrc + src;

  if (validatorsRendered) {

    const dialect = dialectFactory({
      ...options,

      renameValidator(jtdName, node) {
        if (node.nodeType !== JtdNodeType.REF) {
          return renameValidator(jtdName, node);
        }
        const [importedModule, name] = resolveImportRef(node, module, modules);
        return importedModule.exports[name].validatorName;
      },

      renameTypeGuard(jtdName, node) {
        if (node.nodeType !== JtdNodeType.REF) {
          return renameTypeGuard(jtdName, node);
        }
        const [importedModule, name] = resolveImportRef(node, module, modules);
        return importedModule.exports[name].typeGuardName;
      },
    });

    src = compileJsSource(dialect.import())
        + src
        + compileValidators(module.definitions, dialect, options);
  }

  module.source = src;
}

/**
 * Parses JTD modules as TS modules.
 *
 * @param jtdModules The map from path to a JTD definitions.
 * @param options Compiler options.
 */
function createTsModules<M>(jtdModules: Record<string, IJtdDict<M>>, options: Required<ITsModulesCompilerOptions<M, unknown>>): Array<ITsModule> {

  const {
    renameValidator,
    renameTypeAlias,
    renameTypeGuard,
  } = options;

  const modules: Array<ITsModule> = [];

  for (const [jtdPath, jtdDefinitions] of Object.entries(jtdModules)) {

    const module: ITsModule = {
      jtdPath,
      definitions: parseJtdDefinitions(jtdDefinitions),
      source: '',
      exports: createMap(),
    };

    for (const [name, node] of Object.entries(module.definitions)) {
      module.exports[name] = {
        typeName: renameTypeAlias(name, node),
        validatorName: renameValidator(name, node),
        typeGuardName: renameTypeGuard(name, node),
      };
    }

    modules.push(module);
  }

  return modules;
}
