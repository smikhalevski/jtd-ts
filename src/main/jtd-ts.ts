import {
  IJtdEnumNode,
  IJtdNodeMap,
  IJtdObjectNode,
  IJtdTypeNode,
  IJtdUnionNode,
  JtdNode,
  JtdNodeType,
} from './jtd-ast-types';
import {visitJtdNode} from './jtd-visitor';
import {JtdType} from './jtd-types';
import {compileDocComment, compilePropertyName} from './compiler-utils';
import {pascalCase, upperSnakeCase} from './rename-utils';

export interface IJtdTsRenameOptions<Metadata> {

  /**
   * Returns the name of the interface.
   */
  renameInterface: (ref: string, objectNode: IJtdObjectNode<Metadata>) => string;

  /**
   * Returns the name the primitive type alias.
   */
  renameType: (ref: string, node: JtdNode<Metadata>) => string;

  /**
   * Returns the name of the enum.
   */
  renameEnum: (ref: string, node: IJtdEnumNode<Metadata>) => string;
}

/**
 * Returns the TS type name of the `ref` depending on `node` type.
 */
export function renameRef<Metadata>(ref: string, node: JtdNode<Metadata>, options: IJtdTsRenameOptions<Metadata>): string {
  switch (node.nodeType) {
    case JtdNodeType.ANY:
    case JtdNodeType.REF:
    case JtdNodeType.NULLABLE:
    case JtdNodeType.TYPE:
    case JtdNodeType.ELEMENTS:
    case JtdNodeType.VALUES:
    case JtdNodeType.UNION:
      return options.renameType(ref, node);

    case JtdNodeType.ENUM:
      return options.renameEnum(ref, node);

    case JtdNodeType.OBJECT:
      return options.renameInterface(ref, node);
  }
}

/**
 * The TS-specific content of the JTD `metadata` object.
 */
export interface ITsJtdMetadata {

  /**
   * The TS doc comment.
   */
  comment?: string;
}

export interface IJtdTsOptions<Metadata> extends IJtdTsRenameOptions<Metadata> {

  /**
   * Resolves type name for a ref. Invoked only when ref isn't found among known definitions. If omitted then
   * unresolved types are emitted as `never`.
   *
   * @example
   * (ref) => 'Foo.' + upperFirst(camelCase(ref))
   */
  resolveRef: JtdRefResolver<Metadata>;

  /**
   * Returns a TS name of the type that represents a custom type used in JTD. Standard JTD types are converted
   * automatically.
   *
   * @example
   * (node) => node.type === 'int64' ? 'bigint' : 'string'
   */
  rewriteType: (node: IJtdTypeNode<Metadata>) => string;

  /**
   * Returns the name of an object property.
   */
  renameProperty: (propKey: string, node: JtdNode<Metadata>, objectNode: IJtdObjectNode<Metadata>) => string;

  /**
   * Returns the name of the enum value.
   */
  renameEnumValue: (value: string, node: IJtdEnumNode<Metadata>) => string;

  /**
   * Returns the contents of the enum value.
   */
  rewriteEnumValue: (value: string, node: IJtdEnumNode<Metadata>) => string | number | undefined;

  /**
   * Returns the name of the enum that holds mapping keys for discriminated union of interfaces.
   */
  renameUnionEnum: (unionRef: string, unionNode: IJtdUnionNode<Metadata>) => string;

  /**
   * Returns the contents of the value from the enum that holds discriminator values from the discriminated union.
   */
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

export type JtdRefResolver<Metadata> = (ref: string, node: JtdNode<Metadata>) => string;

/**
 * Compiles provided JTD definitions as a TS source that represents a set of types, interfaces and enums.
 */
export function compileTsFromJtdDefinitions<Metadata extends ITsJtdMetadata>(definitions: IJtdNodeMap<Metadata>, options?: Partial<IJtdTsOptions<Metadata>>): string {
  const opts = Object.assign({}, jtdTsOptions, options);

  const resolveRef: JtdRefResolver<Metadata> = (ref, refNode) => {
    const node = definitions[ref];
    return node ? renameRef(ref, node, opts) : opts.resolveRef(ref, refNode);
  };

  return Object.entries(definitions).reduce((source, [ref, node]) => source + compileStatement(ref, node, resolveRef, opts), '');
}

function compileStatement<Metadata extends ITsJtdMetadata>(ref: string, node: JtdNode<Metadata>, resolveRef: JtdRefResolver<Metadata>, options: IJtdTsOptions<Metadata>): string {
  const {
    renameProperty,
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

    visitAny: compileTypeStatement,
    visitRef: compileTypeStatement,
    visitNullable: compileTypeStatement,
    visitType: compileTypeStatement,
    visitElements: compileTypeStatement,
    visitValues: compileTypeStatement,

    visitEnum(node, next) {
      source += compileJtdComment(node) + `export enum ${renameEnum(ref, node)}{`;
      next();
      source += '}';
    },

    visitEnumValue(value, node) {
      source += renameEnumValue(value, node) + '=' + JSON.stringify(rewriteEnumValue(value, node)) + ',';
    },

    visitObject(node, next) {
      source += compileJtdComment(node) + `export interface ${renameInterface(ref, node)}{`;
      next();
      source += '}';
    },

    visitProperty(propKey, propNode, objectNode) {
      source += compileJtdComment(propNode)
          + compilePropertyName(renameProperty(propKey, propNode, objectNode))
          + ':'
          + compileExpression(propNode, resolveRef, options)
          + ';';
    },

    visitOptionalProperty(propKey, propNode, objectNode) {
      source += compileJtdComment(propNode)
          + compilePropertyName(renameProperty(propKey, propNode, objectNode))
          + '?:'
          + compileExpression(propNode, resolveRef, options)
          + ';';
    },

    visitUnion(node, next) {
      const name = renameType(ref, node);

      const mappingKeys = Object.keys(node.mapping);

      if (mappingKeys.length === 0) {
        source += `export type ${name}=never`;
      } else {
        source += `export enum ${renameUnionEnum(ref, node)}{`
            + mappingKeys.reduce((source, mappingKey) => renameUnionEnumValue(mappingKey, ref, node) + '=' + JSON.stringify(rewriteMappingKey(mappingKey, ref, node)) + ',', '')
            + '}'
            + compileJtdComment(node)
            + `export type ${name}=`
            + mappingKeys.reduce((source, mappingKey) => source + '|' + renameMappingInterface(mappingKey, ref, node), '')
            + ';';
        next();
      }
    },

    visitUnionMapping(mappingKey, mappingNode, unionNode, next) {
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
    visitAny() {
      source += 'any';
    },
    visitRef(node) {
      source += resolveRef(node.ref, node);
    },
    visitNullable(node, next) {
      next();
      source += '|null';
    },
    visitType(node) {
      source += jtdTsTypeMap[node.type as JtdType] || rewriteType(node);
    },
    visitEnum(node, next) {
      next();
    },
    visitEnumValue(value) {
      source += '|' + JSON.stringify(value);
    },
    visitElements(node, next) {
      source += 'Array<';
      next();
      source += '>';
    },
    visitValues(node, next) {
      source += 'Record<string,';
      next();
      source += '>';
    },
    visitObject(node, next) {
      source += '{';
      next();
      source += '}';
    },
    visitProperty(propKey, propNode, objectNode, next) {
      source += compileJtdComment(propNode) + compilePropertyName(propKey) + ':';
      next();
      source += ';';
    },
    visitOptionalProperty(propKey, propNode, objectNode, next) {
      source += compileJtdComment(propNode) + compilePropertyName(propKey) + '?:';
      next();
      source += ';';
    },
    visitUnion(node, next) {
      if (Object.keys(node.mapping).length === 0) {
        source += 'never';
      } else {
        next();
      }
    },
    visitUnionMapping(mappingKey, mappingNode, unionNode, next) {
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
export const jtdTsOptions: IJtdTsOptions<any> = {
  resolveRef: () => 'never',
  renameInterface: (ref) => 'I' + pascalCase(ref),
  renameType: pascalCase,
  renameProperty: (propKey) => propKey,
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
