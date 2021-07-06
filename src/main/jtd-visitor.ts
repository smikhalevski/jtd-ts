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

  /**
   * If set to `true` then children visitors are invoked if parent visitor is absent.
   *
   * @default false
   */
  transient?: boolean;

  visitAny?: (node: IJtdAnyNode<Metadata>) => void;
  visitRef?: (node: IJtdRefNode<Metadata>) => void;
  visitNullable?: (node: IJtdNullableNode<Metadata>, next: () => void) => void;
  visitType?: (node: IJtdTypeNode<Metadata>) => void;
  visitEnum?: (node: IJtdEnumNode<Metadata>, next: () => void) => void;
  visitEnumValue?: (value: string, node: IJtdEnumNode<Metadata>) => void;
  visitElements?: (node: IJtdElementsNode<Metadata>, next: () => void) => void;
  visitValues?: (node: IJtdValuesNode<Metadata>, next: () => void) => void;
  visitObject?: (node: IJtdObjectNode<Metadata>, next: () => void) => void;
  visitProperty?: (propKey: string, propNode: JtdNode<Metadata>, objectNode: IJtdObjectNode<Metadata>, next: () => void) => void;
  visitOptionalProperty?: (propKey: string, propNode: JtdNode<Metadata>, objectNode: IJtdObjectNode<Metadata>, next: () => void) => void;
  visitUnion?: (node: IJtdUnionNode<Metadata>, next: () => void) => void;
  visitUnionMapping?: (mappingKey: string, mappingNode: IJtdObjectNode<Metadata>, unionNode: IJtdUnionNode<Metadata>, next: () => void) => void;
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
export function visitJtdNode<Metadata>(node: JtdNode<Metadata>, visitor: IJtdNodeVisitor<Metadata>): void {
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

function visitJtdObjectNodeProperties<Metadata>(node: IJtdObjectNode<Metadata>, visitor: IJtdNodeVisitor<Metadata>): void {
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
