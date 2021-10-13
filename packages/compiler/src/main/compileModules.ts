import {
  IJtdNodeDict,
  IJtdRefNode,
  IValidatorDialectConfig,
  JtdNode,
  RefResolver,
  ValidatorDialectFactory,
} from '@jtdc/types';
import {compileTypeDefinitions} from './compileTypeDefinitions';
import {compileValidatorFunctions} from './compileValidatorFunctions';
import {ITypeStatementCompilerConfig} from './compileTypeStatement';
import {createMap} from './misc';

export interface IFileMap<T> {
  [filePath: string]: T;
}

/**
 * Returns the name of the TypeScript type referenced by the node.
 *
 * @param node The ref node that describes an import.
 * @param filePath The file path where `node` is located.
 * @param modules Modules that must be searched.
 * @returns Tuple of definition-related exports and the TypeScript import path.
 */
export type Linker<M> = (node: IJtdRefNode<M>, filePath: string, jtdFileMap: IFileMap<IJtdNodeDict<M>>) => [name: string, node: JtdNode<M>, importPath?: string];

export interface IModuleBuilderConfig<M>
    extends ITypeStatementCompilerConfig<M>,
            IValidatorDialectConfig<M> {

  /**
   * Linker that resolves cross-module imports.
   */
  linker: Linker<M>;

  /**
   * The callback that produces the validator compilation dialect.
   */
  validatorDialectFactory: ValidatorDialectFactory<M, unknown>;

  /**
   * If `true` then validator functions are rendered along with types.
   */
  validatorsRendered: boolean;
}

export function compileModules<M>(jtdFileMap: IFileMap<IJtdNodeDict<M>>, config: IModuleBuilderConfig<M>): IFileMap<string> {
  const {
    linker,
    validatorDialectFactory,
    validatorsRendered,
    renameType,
    renameValidatorFunction,
  } = config;

  let dialect;

  if (validatorsRendered) {
    dialect = validatorDialectFactory(config);
  }

  for (const [filePath, definitions] of Object.entries(jtdFileMap)) {

    const imports = createMap<Set<string>>();

    const typeRefResolver: RefResolver<M> = (refNode) => {
      const [name, node, importPath] = linker(refNode, filePath, jtdFileMap);
      const typeName = renameType(name, node);
      if (importPath) {
        (imports[importPath] ||= new Set()).add(typeName);
      }
      return typeName;
    };

    const validatorRefResolver: RefResolver<M> = (refNode) => {
      const [name, node, importPath] = linker(refNode, filePath, jtdFileMap);
      const validatorFunctionName = renameValidatorFunction(name, node);
      if (importPath) {
        (imports[importPath] ||= new Set()).add(validatorFunctionName);
      }
      return validatorFunctionName;
    };

    let src = compileTypeDefinitions(definitions, typeRefResolver, config);

    if (dialect) {
      src += compileValidatorFunctions(definitions, validatorRefResolver, dialect);
    }

    src = (dialect ? dialect.runtimeImport() : '')
        + Object.entries(imports).reduce((src, [importPath, importSet]) => src + `import{${Array.from(importSet).join(',')}}from${JSON.stringify(importPath)};`, '')
        + src;
  }
}
