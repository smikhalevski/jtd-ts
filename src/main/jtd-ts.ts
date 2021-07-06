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
   * Resolves type name for a ref. Invoked only when ref isn't found among known definitions. If omitted then
   * unresolved types are emitted as `never`.
   *
   * @example
   * (ref) => 'Foo.' + upperFirst(camelCase(ref))
   */
  resolveRef: JtdRefResolver<Metadata>;

  /**
   * Returns the name of the interface.
   */
  renameInterface: (ref: string, objectNode: IJtdObjectNode<Metadata>) => string;

  /**
   * Returns the name the primitive type alias.
   */
  renameType: (ref: string, node: JtdNode<Metadata>) => string;

  /**
   * Returns a TS name of the type that represents a custom type used in JTD. Standard JTD types are converted
   * automatically.
   *
   * @example
   * (node) => node.type === 'int64' ? 'bigint' : 'string'
   */
  rewriteType: (node: IJtdTypeNode<Metadata>) => string;

  /**
   * Returns the name of the enum.
   */
  renameEnum: (ref: string, node: IJtdEnumNode<Metadata>) => string;

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

export type JtdRefResolver<Metadata> = (ref: string, node: IJtdRefNode<Metadata>) => string;

export interface IJtdTsCompilationResult {

  /**
   * The source code of the module.
   */
  source: string;

  /**
   * Map from JTD ref to a TS type name of imported types.
   */
  importMap: Map<string, string>;

  /**
   * Map from JTD ref to a TS type name of exported types.
   */
  exportsMap: Map<string, string>;
}

/**
 * Compiles provided JTD definitions as a TS source that represents a set of types, interfaces and enums.
 */
export function compileTsFromJtdDefinitions<Metadata extends ITsJtdMetadata>(definitions: Map<string, JtdNode<Metadata>>, options?: Partial<IJtdTsOptions<Metadata>>): IJtdTsCompilationResult {
  const opt = Object.assign({}, jtdTsOptions, options);

  const {
    resolveRef,
    renameInterface,
    renameType,
    renameEnum,
  } = opt;

  const importMap = new Map<string, string>();
  const exportsMap = new Map<string, string>();

  const refResolver: JtdRefResolver<Metadata> = (ref, refNode) => {
    const node = definitions.get(ref);
    if (!node) {
      const name = resolveRef(ref, refNode);
      importMap.set(ref, name);
      return name;
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

  const source = Array.from(definitions).reduce((source, [ref, node]) => {
    return source + compileStatement(ref, node, refResolver, exportsMap, opt);
  }, '');

  return {source, importMap, exportsMap};
}

function compileStatement<Metadata extends ITsJtdMetadata>(ref: string, node: JtdNode<Metadata>, resolveRef: JtdRefResolver<Metadata>, exportsMap: Map<string, string>, options: IJtdTsOptions<Metadata>): string {
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
    const name = renameType(ref, node);

    exportsMap.set(ref, name);

    source += compileJtdComment(node)
        + `export type ${name}=${compileExpression(node, resolveRef, options)};`;
  };

  visitJtdNode(node, {

    any: compileTypeStatement,
    ref: compileTypeStatement,
    nullable: compileTypeStatement,
    type: compileTypeStatement,
    elements: compileTypeStatement,
    values: compileTypeStatement,

    enum(node, next) {
      const name = renameEnum(ref, node);
      exportsMap.set(ref, name);

      source += compileJtdComment(node) + `export enum ${name}{`;
      next();
      source += '}';
    },

    enumValue(value, node) {
      source += renameEnumValue(value, node) + '=' + JSON.stringify(rewriteEnumValue(value, node)) + ';';
    },

    object(node, next) {
      const name = renameInterface(ref, node);
      exportsMap.set(ref, name);

      source += compileJtdComment(node) + `export interface ${name}{`;
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
      const name = renameType(ref, node);
      exportsMap.set(ref, name);

      const mappingKeys = Array.from(node.mapping.keys());

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
