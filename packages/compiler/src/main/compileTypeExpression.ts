import {IJtdEnumNode, IJtdObjectNode, IJtdTypeNode, IJtdUnionNode, JtdNode, JtdType, RefResolver} from '@jtdc/types';
import {visitJtdNode} from './visitJtdNode';
import {compileDocComment, compilePropertyName} from '@smikhalevski/codegen';
import {die} from './misc';

/**
 * The configuration of the type expression compiler.
 */
export interface ITypeExpressionCompilerConfig<M> {

  /**
   * Returns a TypeScript type name of a JTD primitive type. By default, a {@link primitiveTypeMap} is used to
   * resolve the name.
   *
   * ```ts
   * // Use `bigint` for `int64`, pick a type name from the default mapping
   * // or use `never` if type is unknown.
   * (node) => node.type === 'int64' ? 'bigint' : primitiveTypeMap[node.type] || 'never';
   * ```
   *
   * @see primitiveTypeMap
   */
  rewritePrimitiveType(node: IJtdTypeNode<M>): string;

  /**
   * Returns the contents of the enum value.
   */
  rewriteEnumValue(value: string, node: IJtdEnumNode<M>): string | number | undefined;

  /**
   * Returns the value that would be used as a value of the discriminator property.
   */
  rewriteMappingKey(mappingKey: string, mappingNode: IJtdObjectNode<M>, unionName: string | undefined, unionNode: IJtdUnionNode<M>): string | number | undefined;

  /**
   * Returns the name of the union discriminator property.
   */
  renameDiscriminatorKey(node: IJtdUnionNode<M>): string;

  /**
   * Returns the doc comment string fot the type associated with the node.
   *
   * @default node.metadata?.comment
   */
  getTypeDocComment(node: JtdNode<M>): string | null | undefined;
}

/**
 * Returns the TypeScript type expression that describes the node.
 *
 * @template M The type of the JTD metadata.
 *
 * @param node The JTD node for which TypeScript expression must be compiled.
 * @param refResolver Returns a TypeScript type name referenced by node.
 * @param config Compiler configuration.
 */
export function compileTypeExpression<M>(node: JtdNode<M>, refResolver: RefResolver<M>, config: ITypeExpressionCompilerConfig<M>): string {
  const {
    rewritePrimitiveType,
    rewriteEnumValue,
    rewriteMappingKey,
    renameDiscriminatorKey,
    getTypeDocComment,
  } = config;

  let src = '';

  visitJtdNode(node, {
    any() {
      src += 'any';
    },
    ref(node) {
      src += refResolver(node);
    },
    nullable(node, next) {
      next();
      src += '|null';
    },
    type(node) {
      src += rewritePrimitiveType(node);
    },
    enum(node) {
      src += node.values.reduce((src, value) => src + '|' + JSON.stringify(rewriteEnumValue(value, node)), '');
    },
    elements(node, next) {
      src += 'Array<';
      next();
      src += '>';
    },
    values(node, next) {
      src += 'Record<string,';
      next();
      src += '>';
    },
    object(node, next) {
      src += '{';
      next();
      src += '}';
    },
    property(propKey, propNode, objectNode, next) {
      src += compileDocComment(getTypeDocComment(propNode))
          + compilePropertyName(propKey)
          + ':';
      next();
      src += ';';
    },
    optionalProperty(propKey, propNode, objectNode, next) {
      src += compileDocComment(getTypeDocComment(propNode))
          + compilePropertyName(propKey)
          + '?:';
      next();
      src += ';';
    },
    union(node, next) {
      if (Object.keys(node.mapping).length === 0) {
        src += 'never';
      } else {
        next();
      }
    },
    mapping(mappingKey, mappingNode, unionNode, next) {
      src += '|{'
          + renameDiscriminatorKey(unionNode)
          + ':'
          + JSON.stringify(rewriteMappingKey(mappingKey, mappingNode, undefined, unionNode))
          + ';';
      next();
      src += '}';
    },
  });

  return src;
}

export const typeExpressionCompilerConfig: ITypeExpressionCompilerConfig<any> = {
  rewritePrimitiveType: (node) => primitiveTypeMap[node.type] || die('Unknown type: ' + node.type),
  rewriteEnumValue: (value) => value,
  rewriteMappingKey: (mappingKey) => mappingKey,
  renameDiscriminatorKey: (node) => node.discriminator,
  getTypeDocComment: (node) => node.jtd.metadata?.comment,
};

/**
 * Mapping from the JTD standard data types to TypeScript primitive types.
 */
export const primitiveTypeMap: Record<string, string> = {
  [JtdType.BOOLEAN]: 'boolean',
  [JtdType.STRING]: 'string',
  [JtdType.TIMESTAMP]: 'string',
  [JtdType.FLOAT32]: 'number',
  [JtdType.FLOAT64]: 'number',
  [JtdType.INT8]: 'number',
  [JtdType.UINT8]: 'number',
  [JtdType.INT16]: 'number',
  [JtdType.UINT16]: 'number',
  [JtdType.INT32]: 'number',
  [JtdType.UINT32]: 'number',
};
