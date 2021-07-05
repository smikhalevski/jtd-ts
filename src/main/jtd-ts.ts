import {
  IJtdEnumNode,
  IJtdObjectNode,
  IJtdRefNode,
  IJtdTypeNode,
  IJtdUnionNode,
  JtdNode,
  JtdNodeType,
} from './jtd-ast-types';
import {visitJtdNode} from './jtd-visitor';
import {JtdType} from './jtd-types';
import {compileDocComment, compilePropertyName} from './compile-utils';
import {pascalCase, upperSnakeCase} from './rename-utils';

/**
 * The TS-specific content of the JTD `metadata` object.
 */
export interface ITsJtdMetadata {
  comment?: string;
}

export interface IJtdTsOptions<Metadata extends ITsJtdMetadata> {

  /**
   * Resolves type name for a ref. Invoked only when ref isn't found among known definitions.
   *
   * @example
   * (ref) => 'Foo.' + upperFirst(camelCase(ref))
   */
  resolveRef: JtdRefResolver<Metadata>;
  renameInterface: (ref: string, objectNode: IJtdObjectNode<Metadata>) => string;
  renameType: (ref: string, node: JtdNode<Metadata>) => string;

  /**
   * Returns a TS name of the type that represents a custom type used in JTD. Standard JTD types are converted
   * automatically.
   *
   * @example
   * (node) => node.type === 'int64' ? 'bigint' : 'string'
   */
  rewriteType: (node: IJtdTypeNode<Metadata>) => string;
  renameEnum: (ref: string, node: IJtdEnumNode<Metadata>) => string;
  renameEnumValue: (value: string, node: IJtdEnumNode<Metadata>) => string;
  rewriteEnumValue: (value: string, node: IJtdEnumNode<Metadata>) => string | number | undefined;

  /**
   * Returns the name of the enum that holds mapping keys for discriminated union of interfaces.
   */
  renameUnionEnum: (unionRef: string, unionNode: IJtdUnionNode<Metadata>) => string;
  renameUnionEnumValue: (mappingKey: string, unionRef: string, unionNode: IJtdUnionNode<Metadata>) => string;

  /**
   * Returns the string value that would be used as a value of discriminator property in united interfaces.
   */
  rewriteMappingKey: (mappingKey: string, unionRef: string, unionNode: IJtdUnionNode<Metadata>) => string | number | undefined;

  /**
   * Returns the name of the interface that is part of the discriminated union mapping.
   */
  renameMappingInterface: (mappingKey: string, unionRef: string, unionNode: IJtdUnionNode<Metadata>) => string;
}

export type JtdRefResolver<Metadata> = (ref: string, node: IJtdRefNode<Metadata>) => string;

/**
 * Compiles provided JTD definitions as a TS source that represents a set of types, interfaces and enums.
 */
export function compileTsFromJtdDefinitions<Metadata extends ITsJtdMetadata>(definitions: Map<string, JtdNode<Metadata>>, options?: Partial<IJtdTsOptions<Metadata>>): string {
  const opt = Object.assign({}, jtdTsOptions, options);

  const {
    resolveRef,
    renameInterface,
    renameType,
    renameEnum,
  } = opt;

  const refResolver: JtdRefResolver<Metadata> = (ref, refNode) => {
    const node = definitions.get(ref);
    if (!node) {
      return resolveRef(ref, refNode);
    }
    switch (node.nodeType) {
      case JtdNodeType.ANY:
      case JtdNodeType.REF:
      case JtdNodeType.NULLABLE:
      case JtdNodeType.TYPE:
      case JtdNodeType.ELEMENTS:
      case JtdNodeType.VALUES:
      case JtdNodeType.UNION:
        return renameType(ref, node);

      case JtdNodeType.ENUM:
        return renameEnum(ref, node);

      case JtdNodeType.OBJECT:
        return renameInterface(ref, node);
    }
  };

  return Array.from(definitions).reduce((source, [ref, node]) => source + compileStatement(ref, node, refResolver, opt), '');
}

function compileStatement<Metadata extends ITsJtdMetadata>(ref: string, node: JtdNode<Metadata>, resolveRef: JtdRefResolver<Metadata>, options: IJtdTsOptions<Metadata>): string {
  const {
    renameInterface,
    renameType,
    renameEnum,
    renameEnumValue,
    rewriteEnumValue,
    renameUnionEnum,
    renameUnionEnumValue,
    rewriteMappingKey,
    renameMappingInterface,
  } = options;

  let source = '';

  const compileTypeStatement = (node: JtdNode<Metadata>): void => {
    source += compileJtdComment(node)
        + `export type ${renameType(ref, node)}=${compileExpression(node, resolveRef, options)};`;
  };

  visitJtdNode(node, {

    any: compileTypeStatement,
    ref: compileTypeStatement,
    nullable: compileTypeStatement,
    type: compileTypeStatement,
    elements: compileTypeStatement,
    values: compileTypeStatement,

    enum(node, next) {
      source += compileJtdComment(node) + `export enum ${renameEnum(ref, node)}{`;
      next();
      source += '}';
    },

    enumValue(value, node) {
      source += renameEnumValue(value, node) + '=' + JSON.stringify(rewriteEnumValue(value, node)) + ';';
    },

    object(node, next) {
      source += compileJtdComment(node) + `export interface ${renameInterface(ref, node)}{`;
      next();
      source += '}';
    },

    property(propKey, propNode) {
      source += compileJtdComment(propNode)
          + compilePropertyName(propKey) + ':' + compileExpression(propNode, resolveRef, options) + ';';
    },

    optionalProperty(propKey, propNode) {
      source += compileJtdComment(propNode)
          + compilePropertyName(propKey) + ':?' + compileExpression(propNode, resolveRef, options) + ';';
    },

    union(node, next) {
      const mappingKeys = Array.from(node.mapping.keys());

      if (mappingKeys.length === 0) {
        source += `export type ${renameType(ref, node)}=never`;
      } else {
        source += `export enum ${renameUnionEnum(ref, node)}{`
            + mappingKeys.reduce((source, mappingKey) => renameUnionEnumValue(mappingKey, ref, node) + '=' + JSON.stringify(rewriteMappingKey(mappingKey, ref, node)) + ',', '')
            + '}'
            + compileJtdComment(node)
            + `export type ${renameType(ref, node)}=`
            + mappingKeys.reduce((source, mappingKey) => source + '|' + renameMappingInterface(mappingKey, ref, node), '')
            + ';';
        next();
      }
    },

    unionMapping(mappingKey, mappingNode, unionNode, next) {
      source += compileJtdComment(mappingNode)
          + `export interface ${renameMappingInterface(mappingKey, ref, unionNode)}{`
          + compilePropertyName(unionNode.discriminator) + ':' + renameUnionEnum(ref, unionNode) + '.' + renameUnionEnumValue(mappingKey, ref, unionNode) + ';';
      next();
      source += '}';
    },
  });

  return source;
}

function compileExpression<Metadata extends ITsJtdMetadata>(node: JtdNode<Metadata>, resolveRef: JtdRefResolver<Metadata>, options: IJtdTsOptions<Metadata>): string {
  const {rewriteType} = options;

  let source = '';

  visitJtdNode(node, {
    any() {
      source += 'any';
    },
    ref(node) {
      source += resolveRef(node.ref, node);
    },
    nullable(node, next) {
      next();
      source += '|null';
    },
    type(node) {
      source += jtdTsTypeMap[node.type as JtdType] || rewriteType(node);
    },
    enum(node, next) {
      next();
    },
    enumValue(value) {
      source += '|' + JSON.stringify(value);
    },
    elements(node, next) {
      source += 'Array<';
      next();
      source += '>';
    },
    values(node, next) {
      source += 'Record<string,';
      next();
      source += '>';
    },
    object(node, next) {
      source += '{';
      next();
      source += '}';
    },
    property(propKey, propNode, objectNode, next) {
      source += compileJtdComment(propNode) + compilePropertyName(propKey) + ':';
      next();
      source += ';';
    },
    optionalProperty(propKey, propNode, objectNode, next) {
      source += compileJtdComment(propNode) + compilePropertyName(propKey) + '?:';
      next();
      source += ';';
    },
    union(node, next) {
      if (node.mapping.size === 0) {
        source += 'never';
      } else {
        next();
      }
    },
    unionMapping(mappingKey, mappingNode, unionNode, next) {
      source += '|{' + unionNode.discriminator + ':' + JSON.stringify(mappingKey) + ';';
      next();
      source += '}';
    },
  });

  return source;
}

function compileJtdComment(node: JtdNode<ITsJtdMetadata>): string {
  return compileDocComment(node.jtd.metadata?.comment);
}

/**
 * Global default options used by {@link compileTsFromJtdDefinitions}.
 */
export const jtdTsOptions: IJtdTsOptions<ITsJtdMetadata> = {
  resolveRef: () => 'never',
  renameInterface: (ref) => 'I' + pascalCase(ref),
  renameType: pascalCase,
  rewriteType: (node) => jtdTsTypeMap[node.type as JtdType] || 'never',
  renameEnum: pascalCase,
  renameEnumValue: upperSnakeCase,
  rewriteEnumValue: (value) => value,
  renameUnionEnum: (unionRef, unionNode) => pascalCase(unionRef) + pascalCase(unionNode.discriminator),
  renameUnionEnumValue: upperSnakeCase,
  rewriteMappingKey: (mappingKey) => mappingKey,
  renameMappingInterface: (mappingKey, unionRef) => 'I' + pascalCase(unionRef) + pascalCase(mappingKey),
};

export const jtdTsTypeMap: Record<JtdType, string> = {
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
