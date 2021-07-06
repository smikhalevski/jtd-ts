import {IJtd, JtdType} from './jtd-types';

export const enum JtdNodeType {
  ANY,
  REF,
  NULLABLE,
  TYPE,
  ENUM,
  ELEMENTS,
  VALUES,
  OBJECT,
  UNION,
}

export type JtdNode<Metadata> =
    | IJtdAnyNode<Metadata>
    | IJtdRefNode<Metadata>
    | IJtdNullableNode<Metadata>
    | IJtdTypeNode<Metadata>
    | IJtdEnumNode<Metadata>
    | IJtdElementsNode<Metadata>
    | IJtdValuesNode<Metadata>
    | IJtdObjectNode<Metadata>
    | IJtdUnionNode<Metadata>;

export interface IJtdNode<Metadata> {
  nodeType: JtdNodeType;
  jtd: IJtd<Metadata>;
}

export interface IJtdAnyNode<Metadata> extends IJtdNode<Metadata> {
  nodeType: JtdNodeType.ANY;
}

export interface IJtdRefNode<Metadata> extends IJtdNode<Metadata> {
  nodeType: JtdNodeType.REF;
  ref: string;
}

export interface IJtdNullableNode<Metadata> extends IJtdNode<Metadata> {
  nodeType: JtdNodeType.NULLABLE;
  valueNode: JtdNode<Metadata>;
}

export interface IJtdTypeNode<Metadata> extends IJtdNode<Metadata> {
  nodeType: JtdNodeType.TYPE;
  type: JtdType | string;
}

export interface IJtdEnumNode<Metadata> extends IJtdNode<Metadata> {
  nodeType: JtdNodeType.ENUM;
  values: Array<string>;
}

export interface IJtdElementsNode<Metadata> extends IJtdNode<Metadata> {
  nodeType: JtdNodeType.ELEMENTS;
  elementNode: JtdNode<Metadata>;
}

export interface IJtdValuesNode<Metadata> extends IJtdNode<Metadata> {
  nodeType: JtdNodeType.VALUES;
  valueNode: JtdNode<Metadata>;
}

export interface IJtdObjectNode<Metadata> extends IJtdNode<Metadata> {
  nodeType: JtdNodeType.OBJECT;
  properties: IJtdNodeMap<Metadata>;
  optionalProperties: IJtdNodeMap<Metadata>;
}

/**
 * The discriminated union of objects.
 */
export interface IJtdUnionNode<Metadata> extends IJtdNode<Metadata> {
  nodeType: JtdNodeType.UNION;

  /**
   * The name of the property in discriminated objects that holds the mapping key.
   */
  discriminator: string;
  mapping: Record<string, IJtdObjectNode<Metadata>>;
}

/**
 * Mapping from ref to the type definition.
 */
export interface IJtdNodeMap<Metadata> extends Record<string, JtdNode<Metadata>> {
}
