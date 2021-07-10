import {IJtdEnumNode, IJtdObjectNode, IJtdTypeNode, IJtdUnionNode, JtdNode, JtdNodeType} from './jtd-ast-types';
import {visitJtdNode} from './jtd-visitor';
import {JtdType} from './jtd-types';
import {compileDocComment, compilePropertyName, constCase, pascalCase} from '@smikhalevski/ts-codegen-utils';

export interface IJtdTsRefRenameOptions<M> {

  /**
   * Returns the name of the interface.
   */
  renameInterface?: (ref: string, node: IJtdObjectNode<M>) => string;

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
   * Resolves type name for a ref. Invoked only when ref isn't found among known definitions.
   *
   * @example
   * (ref) => 'Foo.' + upperFirst(camelCase(ref))
   */
  resolveRef?: JtdRefResolver<M>;

  /**
   * Returns a TS name of the type that represents a custom type used in JTD.
   *
   * @see {@link jtdTsTypeMap}
   * @example
   * (node) => node.type === 'int64' ? 'bigint' : 'string'
   */
  rewriteType?: (node: IJtdTypeNode<M>) => string;

  /**
   * Returns the name of an object property.
   */
  renamePropertyKey?: (propKey: string, propNode: JtdNode<M>, objectNode: IJtdObjectNode<M>) => string;

  /**
   * Returns the name of the enum value.
   */
  renameEnumKey?: (value: string, node: IJtdEnumNode<M>) => string;

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
  renameUnionEnumKey?: (mappingKey: string, mappingNode: IJtdObjectNode<M>, unionRef: string, unionNode: IJtdUnionNode<M>) => string;

  /**
   * Returns the name of the union discriminator property.
   */
  renameDiscriminatorKey?: (node: IJtdUnionNode<M>) => string;

  /**
   * Returns the string value that would be used as a value of discriminator property in united interfaces.
   */
  rewriteMappingKey?: (mappingKey: string, mappingNode: IJtdObjectNode<M>, unionRef: string | undefined, unionNode: IJtdUnionNode<M>) => string | number | undefined;

  /**
   * Returns the name of the interface that is part of the discriminated union mapping.
   */
  renameMappingInterface?: (mappingKey: string, mappingNode: IJtdObjectNode<M>, unionRef: string, unionNode: IJtdUnionNode<M>) => string;

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
export function compileTsFromJtdDefinitions<M>(definitions: Record<string, JtdNode<M>>, options?: IJtdTsOptions<M>): string {
  const opts = Object.assign({}, jtdTsOptions, options);

  const resolveRef: JtdRefResolver<M> = (ref, refNode) => {
    const node = definitions[ref];
    return node ? renameRef(ref, node, opts) : opts.resolveRef(ref, refNode);
  };

  return Object.entries(definitions).reduce((src, [ref, node]) => src + compileStatement(ref, node, resolveRef, opts), '');
}

function compileStatement<M>(ref: string, node: JtdNode<M>, resolveRef: JtdRefResolver<M>, options: Required<IJtdTsOptions<M>>): string {
  const {
    renamePropertyKey,
    renameInterface,
    renameType,
    renameEnum,
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
          + `export interface ${renameInterface(ref, node)}{`;
      next();
      src += '}';
    },

    property(propKey, propNode, objectNode) {
      src += compileDocComment(getDocComment(propNode))
          + compilePropertyName(renamePropertyKey(propKey, propNode, objectNode))
          + ':'
          + compileExpression(propNode, resolveRef, options)
          + ';';
    },

    optionalProperty(propKey, propNode, objectNode) {
      src += compileDocComment(getDocComment(propNode))
          + compilePropertyName(renamePropertyKey(propKey, propNode, objectNode))
          + '?:'
          + compileExpression(propNode, resolveRef, options)
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

function compileExpression<M>(node: JtdNode<M>, resolveRef: JtdRefResolver<M>, options: Required<IJtdTsOptions<M>>): string {
  const {
    rewriteType,
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
  resolveRef: (ref) => {
    throw new Error('Unresolved reference: ' + ref);
  },

  renameInterface: (ref) => 'I' + pascalCase(ref),
  renameType: pascalCase,
  renamePropertyKey: (propKey) => propKey,
  rewriteType: (node) => {
    if (node.type in jtdTsTypeMap) {
      return jtdTsTypeMap[node.type];
    }
    throw new Error('Unexpected type: ' + node.type);
  },

  renameEnum: pascalCase,
  renameEnumKey: constCase,
  rewriteEnumValue: (value) => value,
  renameUnionEnum: (ref, node) => pascalCase(ref) + pascalCase(node.discriminator),
  renameUnionEnumKey: constCase,
  renameDiscriminatorKey: (node) => node.discriminator,
  rewriteMappingKey: (mappingKey) => mappingKey,
  renameMappingInterface: (mappingKey, mappingNode, unionRef) => 'I' + pascalCase(unionRef) + pascalCase(mappingKey),
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
