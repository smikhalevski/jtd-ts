import {
  compileTypeExpression,
  ITypeExpressionCompilerConfig,
  typeExpressionCompilerConfig,
} from './compileTypeExpression';
import {IJtdEnumNode, IJtdObjectNode, IJtdUnionNode, JtdNode, RefResolver} from '@jtdc/types';
import {visitJtdNode} from './visitJtdNode';
import {constantCase, pascalCase} from 'change-case-all';
import {compileDocComment, compilePropertyName} from '@smikhalevski/codegen';

/**
 * The configuration of the type statement compiler.
 */
export interface ITypeStatementCompilerConfig<M> extends ITypeExpressionCompilerConfig<M> {

  /**
   * Returns a TypeScript type name described by `node`.
   *
   * ```ts
   * // Add the "I" prefix to the interface names.
   * (name, node) => (node.nodeType === JtdNodeType.OBJECT ? 'I' : '') + pascalCase(name);
   * ```
   *
   * @param name The JTD definition name.
   * @param node The node that describes the renamed type.
   *
   * @see JtdNodeType
   */
  renameType(name: string, node: JtdNode<M>): string;

  /**
   * Returns the new name of an object property.
   */
  renamePropertyKey(propKey: string, propNode: JtdNode<M>, objectNode: IJtdObjectNode<M>): string;

  /**
   * Returns the name of the enum key.
   */
  renameEnumKey(value: string, node: IJtdEnumNode<M>): string;

  /**
   * Returns the name of the enum that holds mapping keys for the discriminated union.
   */
  renameUnionEnum(name: string, node: IJtdUnionNode<M>): string;

  /**
   * Returns the contents of the value from the enum that holds discriminator values.
   */
  renameUnionEnumKey(mappingKey: string, mappingNode: IJtdObjectNode<M>, unionName: string, unionNode: IJtdUnionNode<M>): string;

  /**
   * Returns the name of the interface that is the part of the discriminated union.
   */
  renameMappingInterface(mappingKey: string, mappingNode: IJtdObjectNode<M>, unionName: string, unionNode: IJtdUnionNode<M>): string;
}

/**
 * Returns the TypeScript type statement that describes the node.
 *
 * @template M The type of the JTD metadata.
 *
 * @param name The JTD definition name.
 * @param node The JTD node to compile.
 * @param refResolver Returns a TypeScript type name referenced by node.
 * @param config Compiler config.
 */
export function compileTypeStatement<M>(name: string, node: JtdNode<M>, refResolver: RefResolver<M>, config: ITypeStatementCompilerConfig<M>): string {
  const {
    renameType,
    renamePropertyKey,
    renameEnumKey,
    rewriteEnumValue,
    renameUnionEnum,
    renameUnionEnumKey,
    renameDiscriminatorKey,
    rewriteMappingKey,
    renameMappingInterface,
    getTypeDocComment,
  } = config;

  let src = '';

  const compileTypeAliasStatement = (node: JtdNode<M>): void => {
    src += compileDocComment(getTypeDocComment(node))
        + `export type ${renameType(name, node)}=${compileTypeExpression(node, refResolver, config)};`;
  };

  visitJtdNode(node, {

    any: compileTypeAliasStatement,
    ref: compileTypeAliasStatement,
    nullable: compileTypeAliasStatement,
    type: compileTypeAliasStatement,
    elements: compileTypeAliasStatement,
    values: compileTypeAliasStatement,

    enum(node) {
      const enumName = renameType(name, node);

      src += compileDocComment(getTypeDocComment(node))
          + `export enum ${enumName}{`;

      for (const value of node.values) {
        src += renameEnumKey(value, node)
            + '='
            + JSON.stringify(rewriteEnumValue(value, node))
            + ',';
      }
      src += '}';
    },

    object(node, next) {
      src += compileDocComment(getTypeDocComment(node))
          + `export interface ${renameType(name, node)}{`;
      next();
      src += '}';
    },

    property(propKey, propNode, objectNode) {
      src += compileDocComment(getTypeDocComment(propNode))
          + compilePropertyName(renamePropertyKey(propKey, propNode, objectNode))
          + ':'
          + compileTypeExpression(propNode, refResolver, config)
          + ';';
    },

    optionalProperty(propKey, propNode, objectNode) {
      src += compileDocComment(getTypeDocComment(propNode))
          + compilePropertyName(renamePropertyKey(propKey, propNode, objectNode))
          + '?:'
          + compileTypeExpression(propNode, refResolver, config)
          + ';';
    },

    union(node, next) {
      const unionName = renameType(name, node);
      const mappingEntries = Object.entries(node.mapping);

      if (mappingEntries.length === 0) {
        src += `export type ${unionName}=never;`;
        return;
      }

      const enumName = renameUnionEnum(name, node);
      src += `export enum ${enumName}{`
          + mappingEntries.reduce((src, [mappingKey, mappingNode]) => src
              + renameUnionEnumKey(mappingKey, mappingNode, name, node)
              + '='
              + JSON.stringify(rewriteMappingKey(mappingKey, mappingNode, name, node))
              + ',',
              '',
          )
          + '}'
          + compileDocComment(getTypeDocComment(node))
          + `export type ${unionName}=`
          + mappingEntries.reduce((src, [mappingKey, mappingNode]) => src
              + '|' + renameMappingInterface(mappingKey, mappingNode, name, node),
              '',
          )
          + ';';
      next();
    },

    mapping(mappingKey, mappingNode, unionNode, next) {
      src += compileDocComment(getTypeDocComment(mappingNode))
          + `export interface ${renameMappingInterface(mappingKey, mappingNode, name, unionNode)}{`
          + compilePropertyName(renameDiscriminatorKey(unionNode))
          + ':'
          + renameUnionEnum(name, unionNode) + '.' + renameUnionEnumKey(mappingKey, mappingNode, name, unionNode)
          + ';';
      next();
      src += '}';
    },
  });

  return src;
}

export const typeStatementCompilerConfig: ITypeStatementCompilerConfig<any> = {
  ...typeExpressionCompilerConfig,

  renameType: (name) => pascalCase(name),
  renamePropertyKey: (propKey) => propKey,
  renameEnumKey: (name) => constantCase(name),
  renameUnionEnum: (name, node) => pascalCase(name) + pascalCase(node.discriminator),
  renameUnionEnumKey: (name) => constantCase(name),
  renameMappingInterface: (mappingKey, mappingNode, unionName) => pascalCase(unionName) + pascalCase(mappingKey),
};
