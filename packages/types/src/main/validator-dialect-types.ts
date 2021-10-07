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
 * A factory that produces a validator compilation dialect with given configuration.
 */
export type ValidatorDialectFactory<M, C> = (config: IValidatorDialectConfig<M>) => IValidatorDialect<M, C>;

/**
 * Configuration provided to all validator dialect factories.
 *
 * @template M The type of the JTD metadata.
 */
export interface IValidatorDialectConfig<M> {

  /**
   * Returns the name of the emitted validator function.
   *
   * @param name The JTD definition name.
   * @param node The node that describes the definition.
   * @returns The name of the validator function.
   */
  renameValidator(name: string, node: JtdNode<M>): string;

  /**
   * Returns the name of an object property.
   *
   * @param propKey The name of the property as defined in JTD.
   * @param propNode The node that describes the property value.
   * @param objectNode The node that describes the object that contains the property.
   * @returns The name of the property.
   */
  renamePropertyKey(propKey: string, propNode: JtdNode<M>, objectNode: IJtdObjectNode<M>): string;

  /**
   * Returns the name of the union discriminator property.
   */
  renameDiscriminatorKey(node: IJtdUnionNode<M>): string;

  /**
   * Returns the contents of the enum value.
   */
  rewriteEnumValue(value: string, node: IJtdEnumNode<M>): string | number | undefined;

  /**
   * Returns the string value that would be used as a value of discriminator property in united interfaces.
   */
  rewriteMappingKey(mappingKey: string, mappingNode: IJtdObjectNode<M>, unionName: string | undefined, unionNode: IJtdUnionNode<M>): string | number | undefined;

  /**
   * Returns the name of the type guard function.
   */
  renameTypeGuard(name: string, node: JtdNode<M>): string;

  /**
   * Returns a TypeScript type name described by `node`.
   *
   * @param name The JTD definition name.
   * @param node The node that describes the renamed type.
   */
  renameType(name: string, node: JtdNode<M>): string;
}

/**
 * The validator dialect that describes how validators and type narrowing functions are generated.
 *
 * @template M The type of the JTD metadata.
 * @template C The type of the context.
 */
export interface IValidatorDialect<M, C> {

  /**
   * Returns a dialect runtime import statement source code.
   */
  import(): IFragmentCgNode;

  /**
   * Returns a type guard function source code.
   *
   * @param name The JTD definition name.
   * @param node The node that describes the type definition.
   */
  typeGuard(name: string, node: JtdNode<M>): IFragmentCgNode;

  /**
   * Returns the validator function source code.
   *
   * @param name The JTD definition name.
   * @param node The node that describes the type definition.
   * @param next The callback that returns the source code of the validator.
   */
  validator(name: string, node: JtdNode<M>, next: (ctx: C) => IFragmentCgNode): IFragmentCgNode;

  /**
   * Returns the source code of the referenced validator invocation.
   */
  ref(node: IJtdRefNode<M>, ctx: C): IFragmentCgNode;
  nullable(node: IJtdNullableNode<M>, ctx: C, next: (ctx: C) => IFragmentCgNode): IFragmentCgNode;
  type(node: IJtdTypeNode<M>, ctx: C): IFragmentCgNode;
  enum(node: IJtdEnumNode<M>, ctx: C): IFragmentCgNode;
  elements(node: IJtdElementsNode<M>, ctx: C, next: (ctx: C) => IFragmentCgNode): IFragmentCgNode;
  values(node: IJtdValuesNode<M>, ctx: C, next: (ctx: C) => IFragmentCgNode): IFragmentCgNode;
  object(node: IJtdObjectNode<M>, ctx: C, next: (ctx: C) => IFragmentCgNode): IFragmentCgNode;
  property(propKey: string, propNode: JtdNode<M>, objectNode: IJtdObjectNode<M>, ctx: C, next: (ctx: C) => IFragmentCgNode): IFragmentCgNode;
  optionalProperty(propKey: string, propNode: JtdNode<M>, objectNode: IJtdObjectNode<M>, ctx: C, next: (ctx: C) => IFragmentCgNode): IFragmentCgNode;
  union(node: IJtdUnionNode<M>, ctx: C, next: (ctx: C) => IFragmentCgNode): IFragmentCgNode;
  mapping(mappingKey: string, mappingNode: IJtdObjectNode<M>, unionNode: IJtdUnionNode<M>, ctx: C, next: (ctx: C) => IFragmentCgNode): IFragmentCgNode;
}
