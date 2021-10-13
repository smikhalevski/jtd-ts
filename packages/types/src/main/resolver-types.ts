import {IJtdRefNode} from './jtd-ast-types';

export type RefResolver<M> = (node: IJtdRefNode<M>) => string;
