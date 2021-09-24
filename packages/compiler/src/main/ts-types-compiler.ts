import {IJtdEnumNode, IJtdObjectNode, IJtdRefNode, IJtdTypeNode, IJtdUnionNode, JtdNode, JtdType} from '@jtdc/types';
import {visitJtdNode} from './jtd-visitor';
import {compileDocComment, compilePropertyName} from '@smikhalevski/codegen';
import {constantCase, pascalCase} from 'change-case-all';
import {die} from './misc';

export interface ITsTypesCompilerOptions<M> {

  /**
   * Returns a TypeScript type name referenced by `node`.
   */
  resolveExternalRef?(node: IJtdRefNode<M>): string;

  /**
   * Returns a TypeScript type name described by `node`.
   *
   * @param ref The ref of the renamed type.
   * @param node The node that describes the renamed type.
   */
  renameType?(ref: string, node: JtdNode<M>): string;

  /**
   * Returns a TypeScript type name of a JTD primitive type. By default, a {@link jtdTsPrimitiveTypeMap} is used to
   * resolve the name.
   *
   * @example
   * (node) => node.type === 'int64' ? 'bigint' : 'string'
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
  renameUnionEnum?(ref: string, node: IJtdUnionNode<M>): string;

  /**
   * Returns the contents of the value from the enum that holds discriminator values.
   */
  renameUnionEnumKey?(mappingKey: string, mappingNode: IJtdObjectNode<M>, unionRef: string, unionNode: IJtdUnionNode<M>): string;

  /**
   * Returns the name of the union discriminator property.
   */
  renameDiscriminatorKey?(node: IJtdUnionNode<M>): string;

  /**
   * Returns the value that would be used as a value of the discriminator property.
   */
  rewriteMappingKey?(mappingKey: string, mappingNode: IJtdObjectNode<M>, unionRef: string | undefined, unionNode: IJtdUnionNode<M>): string | number | undefined;

  /**
   * Returns the name of the interface that is the part of the discriminated union.
   */
  renameMappingInterface?(mappingKey: string, mappingNode: IJtdObjectNode<M>, unionRef: string, unionNode: IJtdUnionNode<M>): string;

  /**
   * Returns the doc comment string that is associated with the node.
   *
   * @default node.metadata?.comment
   */
  getDocComment?(node: JtdNode<M>): string | null | undefined;
}

/**
 * Compiles provided JTD definitions as a TypeScript source.
 *
 * @template M The type of the metadata.
 *
 * @param definitions Map from ref to JTD node.
 * @param options The compilation options.
 *
 * @returns The TypeScript source code with type, interface and enum definitions.
 */
export function compileTsTypes<M>(definitions: Record<string, JtdNode<M>>, options?: ITsTypesCompilerOptions<M>): string {
  const opts = {...tsTypesCompilerOptions, ...options};

  return Object.keys(definitions).reduce((src, ref) => src + compileTsTypeStatement(ref, definitions, opts), '');
}

/**
 * Returns the TypeScript type statement that describes the node.
 *
 * @template M The type of the metadata.
 *
 * @param ref The ref of the node in `definitions`.
 * @param definitions Known definitions that are used for ref resolution.
 * @param options Compiler options.
 */
function compileTsTypeStatement<M>(ref: string, definitions: Record<string, JtdNode<M>>, options: Required<ITsTypesCompilerOptions<M>>): string {
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
    getDocComment,
  } = options;

  let src = '';

  const compileTypeStatement = (node: JtdNode<M>): void => {
    src += compileDocComment(getDocComment(node))
        + `export type ${renameType(ref, node)}=${compileTsTypeExpression(node, definitions, options)};`;
  };

  visitJtdNode(definitions[ref], {

    any: compileTypeStatement,
    ref: compileTypeStatement,
    nullable: compileTypeStatement,
    type: compileTypeStatement,
    elements: compileTypeStatement,
    values: compileTypeStatement,

    enum(node) {
      const name = renameType(ref, node);

      src += compileDocComment(getDocComment(node))
          + `enum ${name}{`;

      for (const value of node.values) {
        src += renameEnumKey(value, node)
            + '='
            + JSON.stringify(rewriteEnumValue(value, node))
            + ',';
      }
      src += '}'
          // Support of enum name mangling
          + `export{${name}};`;
    },

    object(node, next) {
      src += compileDocComment(getDocComment(node))
          + `export interface ${renameType(ref, node)}{`;
      next();
      src += '}';
    },

    property(propKey, propNode, objectNode) {
      src += compileDocComment(getDocComment(propNode))
          + compilePropertyName(renamePropertyKey(propKey, propNode, objectNode))
          + ':'
          + compileTsTypeExpression(propNode, definitions, options)
          + ';';
    },

    optionalProperty(propKey, propNode, objectNode) {
      src += compileDocComment(getDocComment(propNode))
          + compilePropertyName(renamePropertyKey(propKey, propNode, objectNode))
          + '?:'
          + compileTsTypeExpression(propNode, definitions, options)
          + ';';
    },

    union(node, next) {
      const unionName = renameType(ref, node);
      const mappingEntries = Object.entries(node.mapping);

      if (mappingEntries.length === 0) {
        src += `export type ${unionName}=never;`;
        return;
      }

      const enumName = renameUnionEnum(ref, node);
      src += `enum ${enumName}{`
          + mappingEntries.reduce((src, [mappingKey, mappingNode]) => src
              + renameUnionEnumKey(mappingKey, mappingNode, ref, node)
              + '='
              + JSON.stringify(rewriteMappingKey(mappingKey, mappingNode, ref, node))
              + ',',
              '',
          )
          + '}'
          // Support of enum name mangling
          + `export{${enumName}};`
          + compileDocComment(getDocComment(node))
          + `export type ${unionName}=`
          + mappingEntries.reduce((src, [mappingKey, mappingNode]) => src
              + '|' + renameMappingInterface(mappingKey, mappingNode, ref, node),
              '',
          )
          + ';';
      next();
    },

    mapping(mappingKey, mappingNode, unionNode, next) {
      src += compileDocComment(getDocComment(mappingNode))
          + `export interface ${renameMappingInterface(mappingKey, mappingNode, ref, unionNode)}{`
          + compilePropertyName(renameDiscriminatorKey(unionNode))
          + ':'
          + renameUnionEnum(ref, unionNode) + '.' + renameUnionEnumKey(mappingKey, mappingNode, ref, unionNode)
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
 * @template M The type of the metadata.
 *
 * @param node The JTD node for which TypeScript expression must be compiled.
 * @param definitions Known definitions that are used for ref resolution.
 * @param options Compiler options.
 */
function compileTsTypeExpression<M>(node: JtdNode<M>, definitions: Record<string, JtdNode<M>>, options: Required<ITsTypesCompilerOptions<M>>): string {
  const {
    resolveExternalRef,
    renameType,
    rewritePrimitiveType,
    rewriteEnumValue,
    rewriteMappingKey,
    renameDiscriminatorKey,
    getDocComment,
  } = options;

  let src = '';

  visitJtdNode(node, {
    any() {
      src += 'any';
    },
    ref(node) {
      src += definitions[node.ref] ? renameType(node.ref, definitions[node.ref]) : resolveExternalRef(node);
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
      src += compileDocComment(getDocComment(propNode))
          + compilePropertyName(propKey)
          + ':';
      next();
      src += ';';
    },
    optionalProperty(propKey, propNode, objectNode, next) {
      src += compileDocComment(getDocComment(propNode))
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
 * Global default options used by {@link compileTsTypes}.
 */
export const tsTypesCompilerOptions: Required<ITsTypesCompilerOptions<any>> = {
  resolveExternalRef: (node) => die('Unresolved reference: ' + node.ref),
  renameType: (ref) => pascalCase(ref),
  renamePropertyKey: (propKey) => propKey,
  rewritePrimitiveType: (node) => jtdTsPrimitiveTypeMap[node.type] || die('Unknown type: ' + node.type),
  renameEnumKey: (ref) => constantCase(ref),
  rewriteEnumValue: (value) => value,
  renameUnionEnum: (ref, node) => pascalCase(ref) + pascalCase(node.discriminator),
  renameUnionEnumKey: (ref) => constantCase(ref),
  renameDiscriminatorKey: (node) => node.discriminator,
  rewriteMappingKey: (mappingKey) => mappingKey,
  renameMappingInterface: (mappingKey, mappingNode, unionRef) => pascalCase(unionRef) + pascalCase(mappingKey),
  getDocComment: (node) => node.jtd.metadata?.comment,
};

/**
 * Mapping from the JTD standard data types to TypeScript primitive types.
 */
export const jtdTsPrimitiveTypeMap: Record<string, string> = {
  [JtdType.BOOLEAN]: 'boolean',
  [JtdType.STRING]: 'string',
  [JtdType.TIMESTAMP]: 'number',
  [JtdType.FLOAT32]: 'number',
  [JtdType.FLOAT64]: 'number',
  [JtdType.INT8]: 'number',
  [JtdType.UINT8]: 'number',
  [JtdType.INT16]: 'number',
  [JtdType.UINT16]: 'number',
  [JtdType.INT32]: 'number',
  [JtdType.UINT32]: 'number',
};
