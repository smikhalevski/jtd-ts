import {compileTypes, ITypesCompilerOptions, RefResolver, typesCompilerOptions} from './types-compiler';
import {parseJtdDefinitions} from './jtd-ast';
import {IJtdDict, IValidatorDialectConfig, JtdNodeType, ValidatorDialectFactory} from '@jtdc/types';
import {createMap} from './misc';
import {compileValidators, IValidatorsCompilerOptions, validatorDialectConfig} from './validators-compiler';
import {compileJsSource} from '@smikhalevski/codegen';
import {IModule, ImportResolver} from './module-types';

export interface IModulesCompilerOptions<M, C>
    extends ITypesCompilerOptions<M>,
            IValidatorsCompilerOptions<M, C>,
            Partial<IValidatorDialectConfig<M>> {

  /**
   * Returns the module and the definition name referenced by node.
   */
  importResolver: ImportResolver<M>;

  /**
   * The callback that produces the validator compilation dialect.
   */
  validatorDialectFactory: ValidatorDialectFactory<M, C>;

  /**
   * If `true` then validator functions are rendered along with types.
   */
  validatorsRendered?: boolean;
}

/**
 * Compiles a map of JTD definitions to a list of modules.
 *
 * @template M The type of the JTD metadata.
 * @template C The type of the context.
 */
export function compileModules<M, C>(jtdModules: Record<string, IJtdDict<M>>, options: IModulesCompilerOptions<M, C>): Array<IModule> {

  const resolvedOptions: Required<IModulesCompilerOptions<M, C>> = {
    validatorsRendered: false,
    typeGuardsRendered: false,
    ...typesCompilerOptions,
    ...validatorDialectConfig,
    ...options,
  };

  const modules = createModules(jtdModules, resolvedOptions);

  for (const module of modules) {
    compileModule(module, modules, resolvedOptions);
  }
  return modules;
}

function compileModule<M>(module: IModule, modules: Array<IModule>, options: Required<IModulesCompilerOptions<M, unknown>>): void {

  const {
    importResolver,
    validatorsRendered,
    validatorDialectFactory,
  } = options;

  const imports = createMap<Set<string>>();

  const refResolver: RefResolver<M> = (node) => {
    const [exports, path] = importResolver(node, module.path, modules);
    const importSet = imports[path] ||= new Set();

    importSet.add(exports.typeName);

    if (validatorsRendered) {
      importSet.add(exports.validatorName);
    }

    return exports.typeName;
  };

  let src = compileTypes(module.definitions, refResolver, options);

  for (const [path, names] of Object.entries(imports)) {
    src = `import{${Array.from(names).join(',')}}from${JSON.stringify(path)};` + src;
  }

  if (validatorsRendered) {

    const dialect = validatorDialectFactory(options);

    src = compileJsSource(dialect.import())
        + src
        + compileValidators(module.definitions, dialect, options);
  }

  module.source = src;
}

/**
 * Parses JTD modules as TS modules.
 *
 * @param jtdModules The map from URI to a JTD definitions.
 * @param options Compiler options.
 */
function createModules<M, C>(jtdModules: Record<string, IJtdDict<M>>, options: Required<IModulesCompilerOptions<M, C>>): Array<IModule> {

  const {
    renameType,
    renameValidator,
    renameTypeGuard,
  } = options;

  const modules: Array<IModule> = [];

  for (const [path, definitions] of Object.entries(jtdModules)) {
    const module: IModule = {
      path,
      definitions: parseJtdDefinitions(definitions),
      source: '',
      exports: createMap(),
    };

    for (const [name, node] of Object.entries(module.definitions)) {
      module.exports[name] = {
        typeName: renameType(name, node),
        validatorName: renameValidator(name, node),
        typeGuardName: renameTypeGuard(name, node),
      };
    }
    modules.push(module);
  }
  return modules;
}
