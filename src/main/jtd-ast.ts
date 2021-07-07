import {IJtd, IJtdMap, IJtdRoot} from './jtd-types';
import {IJtdNodeMap, IJtdObjectNode, IJtdUnionNode, JtdNode, JtdNodeType} from './jtd-ast-types';

/**
 * Converts JTD and its dependencies to a map of nodes where key is `ref` and value is a parsed node.
 *
 * @param ref The ref of the root JTD.
 * @param jtdRoot The JTD to parse.
 */
export function parseJtdRoot<M>(ref: string, jtdRoot: IJtdRoot<M>): IJtdNodeMap<M> {
  const nodes = jtdRoot.definitions ? parseJtdDefinitions(jtdRoot.definitions) : createMap();
  nodes[ref] = parseJtd(jtdRoot);
  return nodes;
}

/**
 * Converts JTD dependencies to a map of nodes where key is `ref` and value is a parsed node.
 *
 * @param definitions The dictionary of ref-JTD pairs.
 */
export function parseJtdDefinitions<M>(definitions: IJtdMap<M>): IJtdNodeMap<M> {
  const nodes: IJtdNodeMap<M> = createMap();

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
    return {
      nodeType: JtdNodeType.NULLABLE,
      valueNode: parseJtd(Object.assign({}, jtd, {nullable: undefined})),
      jtd,
    };
  }

  if (jtdType) {
    return {
      nodeType: JtdNodeType.TYPE,
      type: jtdType,
      jtd,
    };
  }

  if (jtdRef) {
    return {
      nodeType: JtdNodeType.REF,
      ref: jtdRef,
      jtd,
    };
  }

  if (jtdEnum) {
    return {
      nodeType: JtdNodeType.ENUM,
      values: jtdEnum,
      jtd,
    };
  }

  if (jtdElements) {
    return {
      nodeType: JtdNodeType.ELEMENTS,
      elementNode: parseJtd(jtdElements),
      jtd,
    };
  }

  if (jtdValues) {
    return {
      nodeType: JtdNodeType.VALUES,
      valueNode: parseJtd(jtdValues),
      jtd,
    };
  }

  if (jtdProperties || jtdOptionalProperties) {

    const objectNode: IJtdObjectNode<M> = {
      nodeType: JtdNodeType.OBJECT,
      properties: createMap(),
      optionalProperties: createMap(),
      jtd,
    };

    if (jtdProperties) {
      for (const [propKey, propJtd] of Object.entries(jtdProperties)) {
        objectNode.properties[propKey] = parseJtd(propJtd);
      }
    }
    if (jtdOptionalProperties) {
      for (const [propKey, propJtd] of Object.entries(jtdOptionalProperties)) {
        if (propKey in objectNode.properties) {
          throw new Error('Duplicated property: ' + propKey);
        }
        objectNode.optionalProperties[propKey] = parseJtd(propJtd);
      }
    }
    return objectNode;
  }

  if (jtdDiscriminator || jtdMapping) {

    if (!jtdDiscriminator || !jtdMapping) {
      throw new Error('Malformed discriminated union');
    }

    const unionNode: IJtdUnionNode<M> = {
      nodeType: JtdNodeType.UNION,
      discriminator: jtdDiscriminator,
      mapping: createMap(),
      jtd,
    };

    for (const [mappingKey, mappingJtd] of Object.entries(jtdMapping)) {
      const objectNode = parseJtd(mappingJtd);

      if (objectNode.nodeType !== JtdNodeType.OBJECT) {
        throw new Error('Mappings must be object definitions: ' + mappingKey);
      }
      unionNode.mapping[mappingKey] = objectNode;
    }
    return unionNode;
  }

  return {
    nodeType: JtdNodeType.ANY,
    jtd,
  };
}

function createMap() {
  return Object.create(null);
}
