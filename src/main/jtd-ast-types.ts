import {IJtdRoot, JtdType} from './jtd-types';

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

export type JtdNode<M> =
    | IJtdAnyNode<M>
    | IJtdRefNode<M>
    | IJtdNullableNode<M>
    | IJtdTypeNode<M>
    | IJtdEnumNode<M>
    | IJtdElementsNode<M>
    | IJtdValuesNode<M>
    | IJtdObjectNode<M>
    | IJtdUnionNode<M>;

export interface IJtdNode<M> {
  nodeType: JtdNodeType;
  parentNode: JtdNode<M> | null;
  jtd: IJtdRoot<M>;
}

export interface IJtdAnyNode<M> extends IJtdNode<M> {
  nodeType: JtdNodeType.ANY;
}

export interface IJtdRefNode<M> extends IJtdNode<M> {
  nodeType: JtdNodeType.REF;
  ref: string;
}

export interface IJtdNullableNode<M> extends IJtdNode<M> {
  nodeType: JtdNodeType.NULLABLE;
  valueNode: JtdNode<M>;
}

export interface IJtdTypeNode<M> extends IJtdNode<M> {
  nodeType: JtdNodeType.TYPE;
  type: JtdType | string;
}

export interface IJtdEnumNode<M> extends IJtdNode<M> {
  nodeType: JtdNodeType.ENUM;
  values: Array<string>;
}

export interface IJtdElementsNode<M> extends IJtdNode<M> {
  nodeType: JtdNodeType.ELEMENTS;
  elementNode: JtdNode<M>;
}

export interface IJtdValuesNode<M> extends IJtdNode<M> {
  nodeType: JtdNodeType.VALUES;
  valueNode: JtdNode<M>;
}

export interface IJtdObjectNode<M> extends IJtdNode<M> {
  nodeType: JtdNodeType.OBJECT;
  properties: Record<string, JtdNode<M>>;
  optionalProperties: Record<string, JtdNode<M>>;
}

/**
 * The discriminated union of objects.
 */
export interface IJtdUnionNode<M> extends IJtdNode<M> {
  nodeType: JtdNodeType.UNION;

  /**
   * The name of the property in discriminated objects that holds the mapping key.
   */
  discriminator: string;
  mapping: Record<string, IJtdObjectNode<M>>;
}
