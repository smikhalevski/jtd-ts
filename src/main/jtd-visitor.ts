import {
  IJtdAnyNode,
  IJtdElementsNode,
  IJtdEnumNode,
  IJtdMappingNode,
  IJtdNullableNode,
  IJtdObjectNode,
  IJtdPropertyNode,
  IJtdRefNode,
  IJtdTypeNode,
  IJtdUnionNode,
  IJtdValuesNode,
  JtdNode,
  JtdNodeType,
} from './jtd-ast-types';

export interface IJtdNodeVisitor<M> {
  any?: (node: IJtdAnyNode<M>) => void;
  ref?: (node: IJtdRefNode<M>) => void;
  nullable?: (node: IJtdNullableNode<M>, next: () => void) => void;
  type?: (node: IJtdTypeNode<M>) => void;
  enum?: (node: IJtdEnumNode<M>) => void;
  elements?: (node: IJtdElementsNode<M>, next: () => void) => void;
  values?: (node: IJtdValuesNode<M>, next: () => void) => void;
  object?: (node: IJtdObjectNode<M>, next: () => void) => void;
  property?: (node: IJtdPropertyNode<M>, next: () => void) => void;
  union?: (node: IJtdUnionNode<M>, next: () => void) => void;
  mapping?: (node: IJtdMappingNode<M>, next: () => void) => void;
}

/**
 * Invokes callbacks from `visitor` for a node tree under `node`.
 *
 * **Note:** If particular visitor that receives `next` callback is absent then all subtree under the node to which the
 * visitor refers is skipped.
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
      visitor.object?.(node, () => visitJtdNodeArray(node.propertyNodes, visitor));
      break;

    case JtdNodeType.PROPERTY:
      visitor.property?.(node, () => visitJtdNode(node.valueNode, visitor));
      break;

    case JtdNodeType.UNION:
      visitor.union?.(node, () => visitJtdNodeArray(node.mappingNodes, visitor));
      break;

    case JtdNodeType.MAPPING:
      visitor.mapping?.(node, () => visitJtdNode(node.valueNode, visitor));
      break;
  }
}

function visitJtdNodeArray<M>(nodes: Array<JtdNode<M>>, visitor: IJtdNodeVisitor<M>): void {
  for (let i = 0; i < nodes.length; i++) {
    visitJtdNode(nodes[i], visitor);
  }
}
