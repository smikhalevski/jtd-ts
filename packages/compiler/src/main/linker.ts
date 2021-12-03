import {IJtdRefNode} from '@jtdc/types';

export const enum ImportKind {
  WILDCARD = 'wildcard',
  NAMED = 'named',
  DEFAULT = 'default',
}

export interface IImport {
  kind: ImportKind;
  name: string;
  path: string;
}

export type ImportRefResolver<M> = (node: IJtdRefNode<M>, fromPath: string) => [string, IImport?];
