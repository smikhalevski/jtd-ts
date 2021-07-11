import {IFragmentCgNode} from '@smikhalevski/codegen';
import {
  IJtdElementsNode,
  IJtdEnumNode,
  IJtdNullableNode,
  IJtdObjectNode,
  IJtdRefNode,
  IJtdTypeNode,
  IJtdUnionNode,
  IJtdValuesNode,
  JtdNode,
} from './jtd-ast-types';

/**
 * The validator compilation dialect that describes how validators and type narrowing functions are generated.
 */
export interface IJtdcDialect<M, C> {
  import: () => IFragmentCgNode;
  typeNarrowing: (ref: string, node: JtdNode<M>) => IFragmentCgNode;
  validator: (ref: string, node: JtdNode<M>, next: (ctx: C) => IFragmentCgNode) => IFragmentCgNode;
  ref: (node: IJtdRefNode<M>, ctx: C) => IFragmentCgNode;
  nullable: (node: IJtdNullableNode<M>, ctx: C, next: (ctx: C) => IFragmentCgNode) => IFragmentCgNode;
  type: (node: IJtdTypeNode<M>, ctx: C) => IFragmentCgNode;
  enum: (node: IJtdEnumNode<M>, ctx: C) => IFragmentCgNode;
  elements: (node: IJtdElementsNode<M>, ctx: C, next: (ctx: C) => IFragmentCgNode) => IFragmentCgNode;
  values: (node: IJtdValuesNode<M>, ctx: C, next: (ctx: C) => IFragmentCgNode) => IFragmentCgNode;
  object: (node: IJtdObjectNode<M>, ctx: C, next: (ctx: C) => IFragmentCgNode) => IFragmentCgNode;
  property: (propKey: string, propNode: JtdNode<M>, objectNode: IJtdObjectNode<M>, ctx: C, next: (ctx: C) => IFragmentCgNode) => IFragmentCgNode;
  optionalProperty: (propKey: string, propNode: JtdNode<M>, objectNode: IJtdObjectNode<M>, ctx: C, next: (ctx: C) => IFragmentCgNode) => IFragmentCgNode;
  union: (node: IJtdUnionNode<M>, ctx: C, next: (ctx: C) => IFragmentCgNode) => IFragmentCgNode;
  mapping: (mappingKey: string, mappingNode: IJtdObjectNode<M>, unionNode: IJtdUnionNode<M>, ctx: C, next: (ctx: C) => IFragmentCgNode) => IFragmentCgNode;
}
