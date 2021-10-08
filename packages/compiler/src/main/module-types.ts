import {IJtdNodeDict, IJtdRefNode} from '@jtdc/types';

/**
 * Returns the name of the TypeScript type referenced by the node.
 *
 * @param node The ref node that describes an import.
 * @param filePath The file path where `node` is located.
 * @param modules Modules that must be searched.
 * @returns Tuple of definition-related exports and the TypeScript import path.
 */
export type ImportResolver<M> = (node: IJtdRefNode<M>, filePath: string, modules: Array<IModule>) => [IDefinitionExports, string];

/**
 * The TypeScript module.
 */
export interface IModule {

  /**
   * The file path of original definitions.
   */
  filePath: string;

  /**
   * Parsed JTD definitions described by the module.
   */
  definitions: IJtdNodeDict<any>;

  /**
   * Map from the definition name to a map of corresponding exports.
   */
  exports: Record<string, IDefinitionExports>;

  /**
   * The compiled TypeScript source code of the module.
   */
  source: string;
}

/**
 * Export names associated with the JTD definition.
 */
export interface IDefinitionExports {

  /**
   * The name of the TypeScript type.
   */
  typeName: string;

  /**
   * The name of the validator function.
   */
  validatorName: string;

  /**
   * The name of the type guard function.
   */
  typeGuardName: string;
}
