import {
  IJtd,
  IJtdElementsNode,
  IJtdNullableNode,
  IJtdObjectNode,
  IJtdRoot,
  IJtdUnionNode,
  IJtdValuesNode,
  JtdNode,
  JtdNodeType,
} from '@jtdc/types';
import {createMap, die} from './misc';

/**
 * Converts JTD and its dependencies to a map of nodes where key is `ref` and value is a parsed node.
 *
 * @template M The type of the metadata.
 *
 * @param ref The ref of the root JTD.
 * @param jtdRoot The JTD to parse.
 *
 * @returns The map from ref to a parsed node.
 */
export function parseJtdRoot<M>(ref: string, jtdRoot: IJtdRoot<M>): Record<string, JtdNode<M>> {
  const nodes = jtdRoot.definitions ? parseJtdDefinitions(jtdRoot.definitions) : createMap();
  nodes[ref] = parseJtd(jtdRoot);
  return nodes;
}

/**
 * Converts JTD dependencies to a map of nodes where key is `ref` and value is a parsed node.
 *
 * @template M The type of the metadata.
 *
 * @param jtdDefinitions The dictionary of ref-JTD pairs.
 *
 * @returns The map from ref to a parsed node.
 */
export function parseJtdDefinitions<M>(jtdDefinitions: Record<string, IJtd<M>>): Record<string, JtdNode<M>> {
  const nodes = createMap<JtdNode<M>>();

  for (const [ref, jtd] of Object.entries(jtdDefinitions)) {
    nodes[ref] = parseJtd(jtd);
  }
  return nodes;
}

/**
 * Converts JTD to a corresponding node.
 *
 * @template M The type of the metadata.
 *
 * @param jtd The JTD to parse.
 *
 * @returns A parsed node.
 *
 * @see https://tools.ietf.org/html/rfc8927 RFC8927
 * @see https://jsontypedef.com/docs/jtd-in-5-minutes JTD in 5 minutes
 */
export function parseJtd<M>(jtd: IJtd<M>): JtdNode<M> {

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
      valueNode: parseJtd({...jtd, nullable: undefined}),
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

    const objectNode: IJtdObjectNode<M> = {
      nodeType: JtdNodeType.OBJECT,
      properties: createMap(),
      optionalProperties: createMap(),
      parentNode: null,
      jtd,
    };

    if (jtdProperties) {
      for (const [propKey, propJtd] of Object.entries(jtdProperties)) {
        const propNode = objectNode.properties[propKey] = parseJtd(propJtd);
        propNode.parentNode = objectNode;
      }
    }
    if (jtdOptionalProperties) {
      for (const [propKey, propJtd] of Object.entries(jtdOptionalProperties)) {

        if (propKey in objectNode.properties) {
          die('Duplicated property: ' + propKey);
        }
        const propNode = objectNode.optionalProperties[propKey] = parseJtd(propJtd);
        propNode.parentNode = objectNode;
      }
    }
    return objectNode;
  }

  if (jtdDiscriminator || jtdMapping) {

    if (!jtdDiscriminator || !jtdMapping) {
      die('Malformed discriminated union');
    }

    const unionNode: IJtdUnionNode<M> = {
      nodeType: JtdNodeType.UNION,
      discriminator: jtdDiscriminator,
      mapping: createMap(),
      parentNode: null,
      jtd,
    };

    for (const [mappingKey, mappingJtd] of Object.entries(jtdMapping)) {
      const objectNode = parseJtd(mappingJtd);

      if (objectNode.nodeType !== JtdNodeType.OBJECT) {
        die('Mappings must be object definitions: ' + mappingKey);
      }
      unionNode.mapping[mappingKey] = objectNode;
      objectNode.parentNode = unionNode;
    }
    return unionNode;
  }

  return {
    nodeType: JtdNodeType.ANY,
    parentNode: null,
    jtd,
  };
}
