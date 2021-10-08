import {
  IJtdEnumNode,
  IJtdNodeDict,
  IJtdObjectNode,
  IJtdRefNode,
  IJtdTypeNode,
  IJtdUnionNode,
  JtdNode,
  JtdType,
} from '@jtdc/types';
import {visitJtdNode} from './jtd-visitor';
import {compileDocComment, compilePropertyName} from '@smikhalevski/codegen';
import {constantCase, pascalCase} from 'change-case-all';
import {die} from './misc';

/**
 * Returns the name of the TypeScript type referenced by the node.
 */
export type RefResolver<M> = (node: IJtdRefNode<M>) => string;

const throwRefResolver: RefResolver<unknown> = (node) => die('Unresolved reference: ' + node.ref);

export interface ITypesCompilerOptions<M> {

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
  renameType?(name: string, node: JtdNode<M>): string;

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
  rewritePrimitiveType?(node: IJtdTypeNode<M>): string;

  /**
   * Returns the new name of an object property.
   */
  renamePropertyKey?(propKey: string, propNode: JtdNode<M>, objectNode: IJtdObjectNode<M>): string;

  /**
   * Returns the name of the enum key.
   */
  renameEnumKey?(value: string, node: IJtdEnumNode<M>): string;

  /**
   * Returns the contents of the enum value.
   */
  rewriteEnumValue?(value: string, node: IJtdEnumNode<M>): string | number | undefined;

  /**
   * Returns the name of the enum that holds mapping keys for the discriminated union.
   */
  renameUnionEnum?(name: string, node: IJtdUnionNode<M>): string;

  /**
   * Returns the contents of the value from the enum that holds discriminator values.
   */
  renameUnionEnumKey?(mappingKey: string, mappingNode: IJtdObjectNode<M>, unionName: string, unionNode: IJtdUnionNode<M>): string;

  /**
   * Returns the name of the union discriminator property.
   */
  renameDiscriminatorKey?(node: IJtdUnionNode<M>): string;

  /**
   * Returns the value that would be used as a value of the discriminator property.
   */
  rewriteMappingKey?(mappingKey: string, mappingNode: IJtdObjectNode<M>, unionName: string | undefined, unionNode: IJtdUnionNode<M>): string | number | undefined;

  /**
   * Returns the name of the interface that is the part of the discriminated union.
   */
  renameMappingInterface?(mappingKey: string, mappingNode: IJtdObjectNode<M>, unionName: string, unionNode: IJtdUnionNode<M>): string;

  /**
   * Returns the doc comment string fot the type associated with the node.
   *
   * @default node.metadata?.comment
   */
  getTypeDocComment?(node: JtdNode<M>): string | null | undefined;
}

/**
 * Compiles provided JTD definitions as a TypeScript source.
 *
 * @template M The type of the JTD metadata.
 *
 * @param definitions Map from name to JTD node.
 * @param refResolver Returns a TypeScript type name referenced by node.
 * @param options The compilation options.
 * @returns The TypeScript source code with type, interface and enum definitions.
 */
export function compileTypes<M>(definitions: IJtdNodeDict<M>, refResolver: RefResolver<M> = throwRefResolver, options?: ITypesCompilerOptions<M>): string {
  const resolvedOptions = {...typesCompilerOptions, ...options};

  return Object.keys(definitions).reduce((src, jtdName) => src + compileTypeStatement(jtdName, definitions, refResolver, resolvedOptions), '');
}

/**
 * Returns the TypeScript type statement that describes the node.
 *
 * @template M The type of the JTD metadata.
 *
 * @param jtdName The JTD definition name.
 * @param definitions Known definitions that are used for ref resolution.
 * @param refResolver Returns a TypeScript type name referenced by node.
 * @param options Compiler options.
 */
function compileTypeStatement<M>(jtdName: string, definitions: IJtdNodeDict<M>, refResolver: RefResolver<M>, options: Required<ITypesCompilerOptions<M>>): string {
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
  } = options;

  let src = '';

  const compileTypeStatement = (node: JtdNode<M>): void => {
    src += compileDocComment(getTypeDocComment(node))
        + `export type ${renameType(jtdName, node)}=${compileTypeExpression(node, definitions, refResolver, options)};`;
  };

  visitJtdNode(definitions[jtdName], {

    any: compileTypeStatement,
    ref: compileTypeStatement,
    nullable: compileTypeStatement,
    type: compileTypeStatement,
    elements: compileTypeStatement,
    values: compileTypeStatement,

    enum(node) {
      const name = renameType(jtdName, node);

      src += compileDocComment(getTypeDocComment(node))
          + `export enum ${name}{`;

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
          + `export interface ${renameType(jtdName, node)}{`;
      next();
      src += '}';
    },

    property(propKey, propNode, objectNode) {
      src += compileDocComment(getTypeDocComment(propNode))
          + compilePropertyName(renamePropertyKey(propKey, propNode, objectNode))
          + ':'
          + compileTypeExpression(propNode, definitions, refResolver, options)
          + ';';
    },

    optionalProperty(propKey, propNode, objectNode) {
      src += compileDocComment(getTypeDocComment(propNode))
          + compilePropertyName(renamePropertyKey(propKey, propNode, objectNode))
          + '?:'
          + compileTypeExpression(propNode, definitions, refResolver, options)
          + ';';
    },

    union(node, next) {
      const unionName = renameType(jtdName, node);
      const mappingEntries = Object.entries(node.mapping);

      if (mappingEntries.length === 0) {
        src += `export type ${unionName}=never;`;
        return;
      }

      const enumName = renameUnionEnum(jtdName, node);
      src += `export enum ${enumName}{`
          + mappingEntries.reduce((src, [mappingKey, mappingNode]) => src
              + renameUnionEnumKey(mappingKey, mappingNode, jtdName, node)
              + '='
              + JSON.stringify(rewriteMappingKey(mappingKey, mappingNode, jtdName, node))
              + ',',
              '',
          )
          + '}'
          + compileDocComment(getTypeDocComment(node))
          + `export type ${unionName}=`
          + mappingEntries.reduce((src, [mappingKey, mappingNode]) => src
              + '|' + renameMappingInterface(mappingKey, mappingNode, jtdName, node),
              '',
          )
          + ';';
      next();
    },

    mapping(mappingKey, mappingNode, unionNode, next) {
      src += compileDocComment(getTypeDocComment(mappingNode))
          + `export interface ${renameMappingInterface(mappingKey, mappingNode, jtdName, unionNode)}{`
          + compilePropertyName(renameDiscriminatorKey(unionNode))
          + ':'
          + renameUnionEnum(jtdName, unionNode) + '.' + renameUnionEnumKey(mappingKey, mappingNode, jtdName, unionNode)
          + ';';
      next();
      src += '}';
    },
  });

  return src;
}

/**
 * Returns the TypeScript type expression that describes the node.
 *
 * @template M The type of the JTD metadata.
 *
 * @param node The JTD node for which TypeScript expression must be compiled.
 * @param definitions Known definitions that are used for ref resolution.
 * @param refResolver Returns a TypeScript type name referenced by node.
 * @param options Compiler options.
 */
function compileTypeExpression<M>(node: JtdNode<M>, definitions: IJtdNodeDict<M>, refResolver: RefResolver<M>, options: Required<ITypesCompilerOptions<M>>): string {
  const {
    renameType,
    rewritePrimitiveType,
    rewriteEnumValue,
    rewriteMappingKey,
    renameDiscriminatorKey,
    getTypeDocComment,
  } = options;

  let src = '';

  visitJtdNode(node, {
    any() {
      src += 'any';
    },
    ref(node) {
      src += definitions[node.ref] ? renameType(node.ref, definitions[node.ref]) : refResolver(node);
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

/**
 * Global default options used by {@link compileTypes}.
 */
export const typesCompilerOptions: Required<ITypesCompilerOptions<any>> = {
  renameType: (name) => pascalCase(name),
  renamePropertyKey: (propKey) => propKey,
  rewritePrimitiveType: (node) => primitiveTypeMap[node.type] || die('Unknown type: ' + node.type),
  renameEnumKey: (name) => constantCase(name),
  rewriteEnumValue: (value) => value,
  renameUnionEnum: (name, node) => pascalCase(name) + pascalCase(node.discriminator),
  renameUnionEnumKey: (name) => constantCase(name),
  renameDiscriminatorKey: (node) => node.discriminator,
  rewriteMappingKey: (mappingKey) => mappingKey,
  renameMappingInterface: (mappingKey, mappingNode, unionName) => pascalCase(unionName) + pascalCase(mappingKey),
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
