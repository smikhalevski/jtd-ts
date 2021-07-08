import {
  IJtdEnumNode,
  IJtdMappingNode,
  IJtdObjectNode,
  IJtdPropertyNode,
  IJtdTypeNode,
  IJtdUnionNode,
  JtdNode,
  JtdNodeType,
  JtdRootNode,
} from './jtd-ast-types';
import {visitJtdNode} from './jtd-visitor';
import {JtdType} from './jtd-types';
import {compileDocComment, compilePropertyName} from './compiler-utils';
import {pascalCase, upperSnakeCase} from './rename-utils';

export interface IJtdTsRefRenameOptions<M> {

  /**
   * Returns the name of the interface.
   */
  renameInterface?: (ref: string, node: IJtdObjectNode<M>) => string;

  /**
   * Returns the name the primitive type alias.
   */
  renameType?: (ref: string, node: JtdRootNode<M>) => string;

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
  renameProperty?: (node: IJtdPropertyNode<M>) => string;

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
  renameUnionEnum?: (ref: string, node: IJtdUnionNode<M>) => string;

  /**
   * Returns the contents of the value from the enum that holds discriminator values from the discriminated union.
   */
  renameUnionEnumValue?: (unionRef: string, mappingNode: IJtdMappingNode<M>) => string;

  /**
   * Returns the name of the union discriminator property.
   */
  renameDiscriminator?: (node: IJtdUnionNode<M>) => string;

  /**
   * Returns the string value that would be used as a value of discriminator property in united interfaces.
   */
  rewriteMappingKey?: (unionRef: string, mappingNode: IJtdMappingNode<M>) => string | number | undefined;

  /**
   * Returns the name of the interface that is part of the discriminated union mapping.
   */
  renameMappingInterface?: (unionRef: string, mappingNode: IJtdMappingNode<M>) => string;

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
export type JtdRefResolver<M> = (ref: string, node: JtdRootNode<M>) => string;

/**
 * Compiles provided JTD definitions as a TS source that represents a set of types, interfaces and enums.
 */
export function compileTsFromJtdDefinitions<M>(definitions: Record<string, JtdRootNode<M>>, options?: IJtdTsOptions<M>): string {
  const opts = Object.assign({}, jtdTsOptions, options);

  const resolveRef: JtdRefResolver<M> = (ref, refNode) => {
    const node = definitions[ref];
    return node ? renameRef(ref, node, opts) : opts.resolveRef(ref, refNode);
  };

  return Object.entries(definitions).reduce((src, [ref, node]) => src + compileStatement(ref, node, resolveRef, opts), '');
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
    renameDiscriminator,
    rewriteMappingKey,
    renameMappingInterface,
    getDocComment,
  } = options;

  let src = '';

  const compileTypeStatement = (node: JtdRootNode<M>): void => {
    src += compileDocComment(getDocComment(node))
        + `export type ${renameType(ref, node)}=${compileExpression(node, resolveRef, options)};`;
  };

  visitJtdNode(node, {

    any: compileTypeStatement,
    ref: compileTypeStatement,
    nullable: compileTypeStatement,
    type: compileTypeStatement,
    elements: compileTypeStatement,
    values: compileTypeStatement,

    enum(node) {
      const name = renameEnum(ref, node);

      src += compileDocComment(getDocComment(node))
          + `enum ${name}{`;

      for (const value of node.values) {
        src += renameEnumValue(value, node)
            + '='
            + JSON.stringify(rewriteEnumValue(value, node))
            + ',';
      }
      src += '}'
          // Support of enum name mangling
          + `export{${name}};`;
    },

    object(node, next) {
      if (node.parentNode?.nodeType === JtdNodeType.MAPPING) {
        next();
        return;
      }
      src += compileDocComment(getDocComment(node))
          + `export interface ${renameInterface(ref, node)}{`;
      next();
      src += '}';
    },

    property(node) {
      src += compileDocComment(getDocComment(node))
          + compilePropertyName(renameProperty(node))
          + (node.optional ? '?:' : ':')
          + compileExpression(node.valueNode, resolveRef, options)
          + ';';
    },

    union(node, next) {
      const unionName = renameType(ref, node);

      if (node.mappingNodes.length === 0) {
        src += `export type ${unionName}=never;`;
        return;
      }

      const enumName = renameUnionEnum(ref, node);
      src += `enum ${enumName}{`
          + node.mappingNodes.reduce((src, mappingNode) => src
              + renameUnionEnumValue(ref, mappingNode)
              + '='
              + JSON.stringify(rewriteMappingKey(ref, mappingNode))
              + ',',
              '',
          )
          + '}'
          // Support of enum name mangling
          + `export{${enumName}};`
          + compileDocComment(getDocComment(node))
          + `export type ${unionName}=`
          + node.mappingNodes.reduce((src, mappingNode) => src + '|' + renameMappingInterface(ref, mappingNode), '')
          + ';';
      next();
    },

    mapping(node, next) {
      src += compileDocComment(getDocComment(node))
          + `export interface ${renameMappingInterface(ref, node)}{`
          + compilePropertyName(renameDiscriminator(node.parentNode))
          + ':'
          + renameUnionEnum(ref, node.parentNode) + '.' + renameUnionEnumValue(ref, node)
          + ';';
      next();
      src += '}';
    },
  });

  return src;
}

function compileExpression<M>(node: JtdNode<M>, resolveRef: JtdRefResolver<M>, options: Required<IJtdTsOptions<M>>): string {
  const {
    rewriteType,
    renameDiscriminator,
    getDocComment,
  } = options;

  let src = '';

  visitJtdNode(node, {
    any() {
      src += 'any';
    },
    ref(node) {
      src += resolveRef(node.ref, node);
    },
    nullable(node, next) {
      next();
      src += '|null';
    },
    type(node) {
      src += rewriteType(node);
    },
    enum(node) {
      src += node.values.reduce((src, value) => src + '|' + JSON.stringify(value), '');
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
      if (node.parentNode?.nodeType === JtdNodeType.MAPPING) {
        next();
        return;
      }
      src += '{';
      next();
      src += '}';
    },
    property(node, next) {
      src += compileDocComment(getDocComment(node))
          + compilePropertyName(node.key)
          + (node.optional ? '?:' : ':');
      next();
      src += ';';
    },
    union(node, next) {
      if (node.mappingNodes.length === 0) {
        src += 'never';
      } else {
        next();
      }
    },
    mapping(node, next) {
      src += '|{'
          + renameDiscriminator(node.parentNode)
          + ':'
          + JSON.stringify(node.key)
          + ';';
      next();
      src += '}';
    },
  });

  return src;
}

/**
 * Returns the TS type name of the `ref` depending on `node` type.
 */
export function renameRef<M>(ref: string, node: JtdRootNode<M>, options: Required<IJtdTsRefRenameOptions<M>>): string {
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
  renameProperty: (node) => node.key,
  rewriteType: (node) => jtdTsTypeMap[node.type] || 'never',
  renameEnum: pascalCase,
  renameEnumValue: upperSnakeCase,
  rewriteEnumValue: (value) => value,
  renameUnionEnum: (ref, node) => pascalCase(ref) + pascalCase(node.discriminator),
  renameUnionEnumValue: (unionRef, mappingNode) => upperSnakeCase(mappingNode.key),
  renameDiscriminator: (node) => node.discriminator,
  rewriteMappingKey: (unionRef, mappingNode) => mappingNode.key,
  renameMappingInterface: (unionRef, mappingNode) => 'I' + pascalCase(unionRef) + pascalCase(mappingNode.key),
  getDocComment: (node) => node.jtd.metadata?.comment,
};

export const jtdTsTypeMap: Record<string, string> = {
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
