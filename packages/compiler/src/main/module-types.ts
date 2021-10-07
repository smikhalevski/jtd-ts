import {IJtdNodeDict, IJtdRefNode} from '@jtdc/types';

/**
 * Returns description of the export that is referenced by the node.
 *
 * @param node The ref node that describes an import.
 * @param fromPath The file path where `node` is located.
 * @param modules Modules that must be searched.
 * @returns Tuple of the definition exports and an import path.
 */
export type ImportResolver<M> = (node: IJtdRefNode<M>, fromPath: string, modules: Array<IModule>) => [IDefinitionExports, string];

/**
 * The TypeScript module.
 */
export interface IModule {

  /**
   * The file path of the module.
   */
  path: string;

  /**
   * Parsed JTD definitions described by the module.
   */
  definitions: IJtdNodeDict<any>;

  /**
   * The compiled TypeScript source code of the module.
   */
  source: string;

  /**
   * Map from the definition name to a map of corresponding exports.
   */
  exports: Record<string, IDefinitionExports>;
}

export interface IDefinitionExports {
  typeName: string;
  validatorName: string;
  typeGuardName: string;
}
