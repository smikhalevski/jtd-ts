import {IJtd, IJtdMap, IJtdRoot} from './jtd-types';
import {
  IJtdElementsNode,
  IJtdMappingNode,
  IJtdNullableNode,
  IJtdObjectNode,
  IJtdPropertyNode,
  IJtdUnionNode,
  IJtdValuesNode,
  JtdNodeType,
  JtdRootNode,
} from './jtd-ast-types';

/**
 * Converts JTD and its dependencies to a map of nodes where key is `ref` and value is a parsed node.
 *
 * @param ref The ref of the root JTD.
 * @param jtdRoot The JTD to parse.
 */
export function parseJtdRoot<M>(ref: string, jtdRoot: IJtdRoot<M>): Record<string, JtdRootNode<M>> {
  const nodes = jtdRoot.definitions ? parseJtdDefinitions(jtdRoot.definitions) : createMap();
  nodes[ref] = parseJtd(jtdRoot);
  return nodes;
}

/**
 * Converts JTD dependencies to a map of nodes where key is `ref` and value is a parsed node.
 *
 * @param definitions The dictionary of ref-JTD pairs.
 */
export function parseJtdDefinitions<M>(definitions: IJtdMap<M>): Record<string, JtdRootNode<M>> {
  const nodes: Record<string, JtdRootNode<M>> = createMap();

  for (const [ref, jtd] of Object.entries(definitions)) {
    nodes[ref] = parseJtd(jtd);
  }
  return nodes;
}

/**
 * Converts JTD to a corresponding node.
 *
 * @param jtd The JTD to parse.
 *
 * @see https://tools.ietf.org/html/rfc8927 RFC8927
 * @see https://jsontypedef.com/docs/jtd-in-5-minutes JTD in 5 minutes
 */
export function parseJtd<M>(jtd: IJtd<M>): JtdRootNode<M> {

  const {
    nullable: jtdNullable,
    type: jtdType,
    ref: jtdRef,
    enum: jtdEnum,
    elements: jtdElements,
    values: jtdValues,
    properties: jtdProperties,
    optionalProperties: jtdOptionalProperties,
    discriminator: jtdDiscriminator,
    mapping: jtdMapping,
  } = jtd;

  if (jtdNullable) {
    const node: IJtdNullableNode<M> = {
      nodeType: JtdNodeType.NULLABLE,
      valueNode: parseJtd(Object.assign({}, jtd, {nullable: undefined})),
      parentNode: null,
      jtd,
    };
    node.valueNode.parentNode = node;
    return node;
  }

  if (jtdType) {
    return {
      nodeType: JtdNodeType.TYPE,
      type: jtdType,
      parentNode: null,
      jtd,
    };
  }

  if (jtdRef) {
    return {
      nodeType: JtdNodeType.REF,
      ref: jtdRef,
      parentNode: null,
      jtd,
    };
  }

  if (jtdEnum) {
    return {
      nodeType: JtdNodeType.ENUM,
      values: jtdEnum,
      parentNode: null,
      jtd,
    };
  }

  if (jtdElements) {
    const node: IJtdElementsNode<M> = {
      nodeType: JtdNodeType.ELEMENTS,
      elementNode: parseJtd(jtdElements),
      parentNode: null,
      jtd,
    };
    node.elementNode.parentNode = node;
    return node;
  }

  if (jtdValues) {
    const node: IJtdValuesNode<M> = {
      nodeType: JtdNodeType.VALUES,
      valueNode: parseJtd(jtdValues),
      parentNode: null,
      jtd,
    };
    node.valueNode.parentNode = node;
    return node;
  }

  if (jtdProperties || jtdOptionalProperties) {

    const propertyNodes: Array<IJtdPropertyNode<M>> = [];
    const objectNode: IJtdObjectNode<M> = {
      nodeType: JtdNodeType.OBJECT,
      parentNode: null,
      propertyNodes,
      jtd,
    };

    if (jtdProperties) {
      for (const [propKey, propJtd] of Object.entries(jtdProperties)) {
        const node: IJtdPropertyNode<M> = {
          nodeType: JtdNodeType.PROPERTY,
          parentNode: objectNode,
          key: propKey,
          optional: false,
          valueNode: parseJtd(propJtd),
          jtd: propJtd,
        };
        node.valueNode.parentNode = node;
        propertyNodes.push(node);
      }
    }

    if (jtdOptionalProperties) {
      for (const [propKey, propJtd] of Object.entries(jtdOptionalProperties)) {
        if (jtdProperties != null && propKey in jtdProperties) {
          throw new Error('Duplicated property: ' + propKey);
        }
        const node: IJtdPropertyNode<M> = {
          nodeType: JtdNodeType.PROPERTY,
          parentNode: objectNode,
          key: propKey,
          optional: true,
          valueNode: parseJtd(propJtd),
          jtd: propJtd,
        };
        node.valueNode.parentNode = node;
        propertyNodes.push(node);
      }
    }
    return objectNode;
  }

  if (jtdDiscriminator || jtdMapping) {

    if (!jtdDiscriminator || !jtdMapping) {
      throw new Error('Malformed discriminated union');
    }

    const mappingNodes: Array<IJtdMappingNode<M>> = [];
    const unionNode: IJtdUnionNode<M> = {
      nodeType: JtdNodeType.UNION,
      parentNode: null,
      discriminator: jtdDiscriminator,
      mappingNodes,
      jtd,
    };

    for (const [mappingKey, mappingJtd] of Object.entries(jtdMapping)) {
      const objectNode = parseJtd(mappingJtd);

      if (objectNode.nodeType !== JtdNodeType.OBJECT) {
        throw new Error('Mappings must be object definitions: ' + mappingKey);
      }

      const node: IJtdMappingNode<M> = {
        nodeType: JtdNodeType.MAPPING,
        parentNode: unionNode,
        key: mappingKey,
        valueNode: objectNode,
        jtd: mappingJtd,
      };
      objectNode.parentNode = node;
      mappingNodes.push(node);
    }
    return unionNode;
  }

  return {
    nodeType: JtdNodeType.ANY,
    parentNode: null,
    jtd,
  };
}

function createMap() {
  return Object.create(null);
}
