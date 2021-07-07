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

export interface IJtdTsRefRenameOptions<M> {

  /**
   * Returns the name of the interface.
   */
  renameInterface?: (ref: string, objectNode: IJtdObjectNode<M>) => string;

  /**
   * Returns the name the primitive type alias.
   */
  renameType?: (ref: string, node: JtdNode<M>) => string;

  /**
   * Returns the name of the enum.
   */
  renameEnum?: (ref: string, node: IJtdEnumNode<M>) => string;
}

export interface IJtdTsOptions<M> extends IJtdTsRefRenameOptions<M> {

  /**
   * Resolves type name for a ref. Invoked only when ref isn't found among known definitions. By default, unresolved
   * types are emitted as `never`.
   *
   * @example
   * (ref) => 'Foo.' + upperFirst(camelCase(ref))
   */
  resolveRef?: JtdRefResolver<M>;

  /**
   * Returns a TS name of the type that represents a custom type used in JTD. Standard JTD types are converted
   * automatically.
   *
   * @example
   * (node) => node.type === 'int64' ? 'bigint' : 'string'
   */
  rewriteType?: (node: IJtdTypeNode<M>) => string;

  /**
   * Returns the name of an object property.
   */
  renameProperty?: (propKey: string, node: JtdNode<M>, objectNode: IJtdObjectNode<M>) => string;

  /**
   * Returns the name of the enum value.
   */
  renameEnumValue?: (value: string, node: IJtdEnumNode<M>) => string;

  /**
   * Returns the contents of the enum value.
   */
  rewriteEnumValue?: (value: string, node: IJtdEnumNode<M>) => string | number | undefined;

  /**
   * Returns the name of the enum that holds mapping keys for discriminated union of interfaces.
   */
  renameUnionEnum?: (unionRef: string, unionNode: IJtdUnionNode<M>) => string;

  /**
   * Returns the contents of the value from the enum that holds discriminator values from the discriminated union.
   */
  renameUnionEnumValue?: (mappingKey: string, unionRef: string, unionNode: IJtdUnionNode<M>) => string;

  /**
   * Returns the string value that would be used as a value of discriminator property in united interfaces.
   */
  rewriteMappingKey?: (mappingKey: string, unionRef: string, unionNode: IJtdUnionNode<M>) => string | number | undefined;

  /**
   * Returns the name of the interface that is part of the discriminated union mapping.
   */
  renameMappingInterface?: (mappingKey: string, unionRef: string, unionNode: IJtdUnionNode<M>) => string;

  /**
   * Returns the doc comment string associated with the node.
   *
   * @default node.metadata?.comment
   */
  getDocComment?: (node: JtdNode<M>) => string | null | undefined;
}

/**
 * Callback that returns the actual type name for the given ref. This may perform lookup in an external dictionary or
 * infer type name from metadata that is accessible through `node`.
 */
export type JtdRefResolver<M> = (ref: string, node: JtdNode<M>) => string;

/**
 * Compiles provided JTD definitions as a TS source that represents a set of types, interfaces and enums.
 */
export function compileTsFromJtdDefinitions<M>(definitions: IJtdNodeMap<M>, options?: IJtdTsOptions<M>): string {
  const opts = Object.assign({}, jtdTsOptions, options);

  const resolveRef: JtdRefResolver<M> = (ref, refNode) => {
    const node = definitions[ref];
    return node ? renameRef(ref, node, opts) : opts.resolveRef(ref, refNode);
  };

  return Object.entries(definitions).reduce((source, [ref, node]) => source + compileStatement(ref, node, resolveRef, opts), '');
}

function compileStatement<M>(ref: string, node: JtdNode<M>, resolveRef: JtdRefResolver<M>, options: Required<IJtdTsOptions<M>>): string {
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
    getDocComment,
  } = options;

  let source = '';

  const compileTypeStatement = (node: JtdNode<M>): void => {
    source += compileDocComment(getDocComment(node))
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
      const name = renameEnum(ref, node);

      source += compileDocComment(getDocComment(node))
          + `enum ${name}{`;
      next();
      source += '}'
          // Support of enum name mangling
          + `export{${name}};`;
    },

    visitEnumValue(value, node) {
      source += renameEnumValue(value, node) + '=' + JSON.stringify(rewriteEnumValue(value, node)) + ',';
    },

    visitObject(node, next) {
      source += compileDocComment(getDocComment(node))
          + `export interface ${renameInterface(ref, node)}{`;
      next();
      source += '}';
    },

    visitProperty(propKey, propNode, objectNode) {
      source += compileDocComment(getDocComment(propNode))
          + compilePropertyName(renameProperty(propKey, propNode, objectNode))
          + ':'
          + compileExpression(propNode, resolveRef, options)
          + ';';
    },

    visitOptionalProperty(propKey, propNode, objectNode) {
      source += compileDocComment(getDocComment(propNode))
          + compilePropertyName(renameProperty(propKey, propNode, objectNode))
          + '?:'
          + compileExpression(propNode, resolveRef, options)
          + ';';
    },

    visitUnion(node, next) {
      const unionName = renameType(ref, node);

      const mappingKeys = Object.keys(node.mapping);

      if (mappingKeys.length === 0) {
        source += `export type ${unionName}=never;`;
        return;
      }

      const enumName = renameUnionEnum(ref, node);
      source += `enum ${enumName}{`
          + mappingKeys.reduce((source, mappingKey) => renameUnionEnumValue(mappingKey, ref, node) + '=' + JSON.stringify(rewriteMappingKey(mappingKey, ref, node)) + ',', '')
          + '}'
          // Support of enum name mangling
          + `export{${enumName}};`
          + compileDocComment(getDocComment(node))
          + `export type ${unionName}=`
          + mappingKeys.reduce((source, mappingKey) => source + '|' + renameMappingInterface(mappingKey, ref, node), '')
          + ';';
      next();
    },

    visitUnionMapping(mappingKey, mappingNode, unionNode, next) {
      source += compileDocComment(getDocComment(mappingNode))
          + `export interface ${renameMappingInterface(mappingKey, ref, unionNode)}{`
          + compilePropertyName(unionNode.discriminator)
          + ':'
          + renameUnionEnum(ref, unionNode) + '.' + renameUnionEnumValue(mappingKey, ref, unionNode)
          + ';';
      next();
      source += '}';
    },
  });

  return source;
}

function compileExpression<M>(node: JtdNode<M>, resolveRef: JtdRefResolver<M>, options: Required<IJtdTsOptions<M>>): string {
  const {rewriteType, getDocComment} = options;

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
      source += rewriteType(node);
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
      source += compileDocComment(getDocComment(propNode)) + compilePropertyName(propKey) + ':';
      next();
      source += ';';
    },
    visitOptionalProperty(propKey, propNode, objectNode, next) {
      source += compileDocComment(getDocComment(propNode)) + compilePropertyName(propKey) + '?:';
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

/**
 * Returns the TS type name of the `ref` depending on `node` type.
 */
export function renameRef<M>(ref: string, node: JtdNode<M>, options: Required<IJtdTsRefRenameOptions<M>>): string {
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
 * Global default options used by {@link compileTsFromJtdDefinitions}.
 */
export const jtdTsOptions: Required<IJtdTsOptions<any>> = {
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
  getDocComment: (node) => node.jtd.metadata?.comment,
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
