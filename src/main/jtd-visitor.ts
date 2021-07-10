import {
  IJtdAnyNode,
  IJtdElementsNode,
  IJtdEnumNode,
  IJtdNullableNode,
  IJtdObjectNode,
  IJtdRefNode,
  IJtdTypeNode,
  IJtdUnionNode,
  IJtdValuesNode,
  JtdNode,
  JtdNodeType,
} from './jtd-ast-types';

/**
 * Defines set of callbacks that {@link visitJtdNode} can invoke.
 */
export interface IJtdNodeVisitor<M> {
  any?: (node: IJtdAnyNode<M>) => void;
  ref?: (node: IJtdRefNode<M>) => void;
  nullable?: (node: IJtdNullableNode<M>, next: () => void) => void;
  type?: (node: IJtdTypeNode<M>) => void;
  enum?: (node: IJtdEnumNode<M>) => void;
  elements?: (node: IJtdElementsNode<M>, next: () => void) => void;
  values?: (node: IJtdValuesNode<M>, next: () => void) => void;
  object?: (node: IJtdObjectNode<M>, next: () => void) => void;
  property?: (propKey: string, propNode: JtdNode<M>, objectNode: IJtdObjectNode<M>, next: () => void) => void;
  optionalProperty?: (propKey: string, propNode: JtdNode<M>, objectNode: IJtdObjectNode<M>, next: () => void) => void;
  union?: (node: IJtdUnionNode<M>, next: () => void) => void;
  mapping?: (mappingKey: string, mappingNode: IJtdObjectNode<M>, unionNode: IJtdUnionNode<M>, next: () => void) => void;
}

/**
 * Invokes callbacks from `visitor` for a node tree under `node`.
 *
 * @param node The root of the JTD node tree.
 * @param visitor Callbacks that must be invoked for nodes under `node`.
 */
export function visitJtdNode<M>(node: JtdNode<M>, visitor: IJtdNodeVisitor<M>): void {

  switch (node.nodeType) {

    case JtdNodeType.ANY:
      visitor.any?.(node);
      break;

    case JtdNodeType.REF:
      visitor.ref?.(node);
      break;

    case JtdNodeType.NULLABLE:
      visitor.nullable?.(node, () => visitJtdNode(node.valueNode, visitor));
      break;

    case JtdNodeType.TYPE:
      visitor.type?.(node);
      break;

    case JtdNodeType.ENUM:
      visitor.enum?.(node);
      break;

    case JtdNodeType.ELEMENTS:
      visitor.elements?.(node, () => visitJtdNode(node.elementNode, visitor));
      break;

    case JtdNodeType.VALUES:
      visitor.values?.(node, () => visitJtdNode(node.valueNode, visitor));
      break;

    case JtdNodeType.OBJECT:
      visitor.object?.(node, () => visitJtdObjectNodeProperties(node, visitor));
      break;

    case JtdNodeType.UNION:
      visitor.union?.(node, () => {
        for (const [mappingKey, mappingNode] of Object.entries(node.mapping)) {
          visitor.mapping?.(mappingKey, mappingNode, node, () => visitJtdObjectNodeProperties(mappingNode, visitor));
        }
      });
      break;
  }
}

function visitJtdObjectNodeProperties<M>(node: IJtdObjectNode<M>, visitor: IJtdNodeVisitor<M>): void {
  for (const [propKey, propNode] of Object.entries(node.properties)) {
    visitor.property?.(propKey, propNode, node, () => visitJtdNode(propNode, visitor));
  }
  for (const [propKey, propNode] of Object.entries(node.optionalProperties)) {
    visitor.optionalProperty?.(propKey, propNode, node, () => visitJtdNode(propNode, visitor));
  }
}
