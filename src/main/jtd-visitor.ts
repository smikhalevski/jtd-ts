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

export interface IJtdNodeVisitor<M> {

  /**
   * If set to `true` then children visitors are invoked if parent visitor is absent.
   *
   * @default false
   */
  transient?: boolean;
  visitAny?: (node: IJtdAnyNode<M>) => void;
  visitRef?: (node: IJtdRefNode<M>) => void;
  visitNullable?: (node: IJtdNullableNode<M>, next: () => void) => void;
  visitType?: (node: IJtdTypeNode<M>) => void;
  visitEnum?: (node: IJtdEnumNode<M>, next: () => void) => void;
  visitEnumValue?: (value: string, node: IJtdEnumNode<M>) => void;
  visitElements?: (node: IJtdElementsNode<M>, next: () => void) => void;
  visitValues?: (node: IJtdValuesNode<M>, next: () => void) => void;
  visitObject?: (node: IJtdObjectNode<M>, next: () => void) => void;
  visitProperty?: (propKey: string, propNode: JtdNode<M>, objectNode: IJtdObjectNode<M>, next: () => void) => void;
  visitOptionalProperty?: (propKey: string, propNode: JtdNode<M>, objectNode: IJtdObjectNode<M>, next: () => void) => void;
  visitUnion?: (node: IJtdUnionNode<M>, next: () => void) => void;
  visitUnionMapping?: (mappingKey: string, mappingNode: IJtdObjectNode<M>, unionNode: IJtdUnionNode<M>, next: () => void) => void;
}

const transientVisit = (node: unknown, next: () => void) => next();
const transientVisitProperty = (key: string, node: unknown, parentNode: unknown, next: () => void) => next();

/**
 * Invokes callbacks from `visitor` for a node tree under `node`.
 *
 * **Note:** By default, if particular visitor that receives `next` callback is absent then all subtree under the node
 * to which the visitor refers is skipped. To change this behavior refer to {@link IJtdNodeVisitor.transient}.
 *
 * @param node The root of the JTD node tree.
 * @param visitor Callbacks that must be invoked for nodes under `node`.
 */
export function visitJtdNode<M>(node: JtdNode<M>, visitor: IJtdNodeVisitor<M>): void {
  const {
    transient,
    visitAny,
    visitRef,
    visitNullable = transient ? transientVisit : undefined,
    visitType,
    visitEnum = transient ? transientVisit : undefined,
    visitEnumValue,
    visitElements = transient ? transientVisit : undefined,
    visitValues = transient ? transientVisit : undefined,
    visitObject = transient ? transientVisit : undefined,
    visitUnion = transient ? transientVisit : undefined,
    visitUnionMapping = transient ? transientVisitProperty : undefined,
  } = visitor;

  switch (node.nodeType) {

    case JtdNodeType.ANY:
      visitAny?.(node);
      break;

    case JtdNodeType.REF:
      visitRef?.(node);
      break;

    case JtdNodeType.NULLABLE:
      visitNullable?.(node, () => visitJtdNode(node.valueNode, visitor));
      break;

    case JtdNodeType.TYPE:
      visitType?.(node);
      break;

    case JtdNodeType.ENUM:
      visitEnum?.(node, () => {
        for (let i = 0; i < node.values.length; i++) {
          visitEnumValue?.(node.values[i], node);
        }
      });
      break;

    case JtdNodeType.ELEMENTS:
      visitElements?.(node, () => visitJtdNode(node.elementNode, visitor));
      break;

    case JtdNodeType.VALUES:
      visitValues?.(node, () => visitJtdNode(node.valueNode, visitor));
      break;

    case JtdNodeType.OBJECT:
      visitObject?.(node, () => visitJtdObjectNodeProperties(node, visitor));
      break;

    case JtdNodeType.UNION:
      visitUnion?.(node, () => {
        for (const [mappingKey, mappingNode] of Object.entries(node.mapping)) {
          visitUnionMapping?.(mappingKey, mappingNode, node, () => visitJtdObjectNodeProperties(mappingNode, visitor));
        }
      });
      break;
  }
}

function visitJtdObjectNodeProperties<M>(node: IJtdObjectNode<M>, visitor: IJtdNodeVisitor<M>): void {
  const {
    transient,
    visitProperty = transient ? transientVisitProperty : undefined,
    visitOptionalProperty = transient ? transientVisitProperty : undefined,
  } = visitor;

  for (const [propKey, propNode] of Object.entries(node.properties)) {
    visitProperty?.(propKey, propNode, node, () => visitJtdNode(propNode, visitor));
  }
  for (const [propKey, propNode] of Object.entries(node.optionalProperties)) {
    visitOptionalProperty?.(propKey, propNode, node, () => visitJtdNode(propNode, visitor));
  }
}
