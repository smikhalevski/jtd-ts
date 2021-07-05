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

export interface IJtdNodeVisitor<Metadata> {
  any?: (node: IJtdAnyNode<Metadata>) => void;
  ref?: (node: IJtdRefNode<Metadata>) => void;
  nullable?: (node: IJtdNullableNode<Metadata>, next: () => void) => void;
  type?: (node: IJtdTypeNode<Metadata>) => void;
  enum?: (node: IJtdEnumNode<Metadata>, next: () => void) => void;
  enumValue?: (value: string, node: IJtdEnumNode<Metadata>) => void;
  elements?: (node: IJtdElementsNode<Metadata>, next: () => void) => void;
  values?: (node: IJtdValuesNode<Metadata>, next: () => void) => void;
  object?: (node: IJtdObjectNode<Metadata>, next: () => void) => void;
  property?: (propKey: string, propNode: JtdNode<Metadata>, objectNode: IJtdObjectNode<Metadata>, next: () => void) => void;
  optionalProperty?: (propKey: string, propNode: JtdNode<Metadata>, objectNode: IJtdObjectNode<Metadata>, next: () => void) => void;
  union?: (node: IJtdUnionNode<Metadata>, next: () => void) => void;
  unionMapping?: (mappingKey: string, mappingNode: IJtdObjectNode<Metadata>, unionNode: IJtdUnionNode<Metadata>, next: () => void) => void;
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
export function visitJtdNode<Metadata>(node: JtdNode<Metadata>, visitor: IJtdNodeVisitor<Metadata>): void {
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
      visitor.enum?.(node, () => {
        node.values.forEach((value) => {
          visitor.enumValue?.(value, node);
        });
      });
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
        node.mapping.forEach((mappingNode, mappingKey) => {
          visitor.unionMapping?.(mappingKey, mappingNode, node, () => visitJtdObjectNodeProperties(mappingNode, visitor));
        });
      });
      break;
  }
}

function visitJtdObjectNodeProperties<Metadata>(node: IJtdObjectNode<Metadata>, visitor: IJtdNodeVisitor<Metadata>): void {
  node.properties.forEach((propNode, propKey) => {
    visitor.property?.(propKey, propNode, node, () => visitJtdNode(propNode, visitor));
  });
  node.optionalProperties.forEach((propNode, propKey) => {
    visitor.optionalProperty?.(propKey, propNode, node, () => visitJtdNode(propNode, visitor));
  });
}
