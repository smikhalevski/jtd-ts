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
 * Options provided to all validator dialect factories.
 *
 * @template M The type of the metadata.
 */
export interface IJtdcDialectOptions<M> {

  /**
   * Returns the name of the emitted validator function.
   */
  renameValidator?: (ref: string, node: JtdNode<M>) => string;

  /**
   * Returns the name of an object property.
   */
  renamePropertyKey?: (propKey: string, propNode: JtdNode<M>, objectNode: IJtdObjectNode<M>) => string;

  /**
   * Returns the name of the union discriminator property.
   */
  renameDiscriminatorKey?: (node: IJtdUnionNode<M>) => string;

  /**
   * Returns the contents of the enum value.
   */
  rewriteEnumValue?: (value: string, node: IJtdEnumNode<M>) => string | number | undefined;

  /**
   * Returns the string value that would be used as a value of discriminator property in united interfaces.
   */
  rewriteMappingKey?: (mappingKey: string, mappingNode: IJtdObjectNode<M>, unionRef: string | undefined, unionNode: IJtdUnionNode<M>) => string | number | undefined;

  /**
   * Returns the name of the type guard function.
   */
  renameTypeGuard?: (ref: string, node: JtdNode<M>) => string;

  /**
   * Returns a TypeScript type name described by `node`.
   *
   * @param ref The ref of the renamed type.
   * @param node The node that describes the renamed type.
   */
  renameType?: (ref: string, node: JtdNode<M>) => string;
}

/**
 * The validator dialect that describes how validators and type narrowing functions are generated.
 *
 * @template M The type of the metadata.
 * @template C The type of the context.
 */
export interface IJtdcDialect<M, C> {

  /**
   * Returns a dialect runtime import statement source code.
   */
  import: () => IFragmentCgNode;

  /**
   * Returns a type guard function source code.
   */
  typeGuard: (ref: string, node: JtdNode<M>) => IFragmentCgNode;

  /**
   * Returns the validator function source code.
   */
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
