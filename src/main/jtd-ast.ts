import {IJtd, IJtdMap, IJtdRoot} from './jtd-types';
import {IJtdNodeMap, IJtdObjectNode, IJtdUnionNode, JtdNode, JtdNodeType} from './jtd-ast-types';

/**
 * Converts JTD and its dependencies to a map of nodes where key is `ref` and value is a parsed node.
 *
 * @param ref The ref of the root JTD.
 * @param jtdRoot The JTD to parse.
 */
export function parseJtdRoot<Metadata>(ref: string, jtdRoot: IJtdRoot<Metadata>): IJtdNodeMap<Metadata> {
  const nodes = jtdRoot.definitions ? parseJtdDefinitions(jtdRoot.definitions) : Object.create(null);
  nodes[ref] = parseJtd(jtdRoot);
  return nodes;
}

/**
 * Converts JTD dependencies to a map of nodes where key is `ref` and value is a parsed node.
 *
 * @param definitions The dictionary of ref-JTD pairs.
 */
export function parseJtdDefinitions<Metadata>(definitions: IJtdMap<Metadata>): IJtdNodeMap<Metadata> {
  const nodes: IJtdNodeMap<Metadata> = Object.create(null);

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
export function parseJtd<Metadata>(jtd: IJtd<Metadata>): JtdNode<Metadata> {

  if (jtd.nullable) {
    return {
      nodeType: JtdNodeType.NULLABLE,
      valueNode: parseJtd(Object.assign({}, jtd, {nullable: undefined})),
      jtd,
    };
  }

  if (jtd.type) {
    return {
      nodeType: JtdNodeType.TYPE,
      type: jtd.type,
      jtd,
    };
  }

  if (jtd.ref) {
    return {
      nodeType: JtdNodeType.REF,
      ref: jtd.ref,
      jtd,
    };
  }

  if (jtd.enum) {
    return {
      nodeType: JtdNodeType.ENUM,
      values: jtd.enum,
      jtd,
    };
  }

  if (jtd.elements) {
    return {
      nodeType: JtdNodeType.ELEMENTS,
      elementNode: parseJtd(jtd.elements),
      jtd,
    };
  }

  if (jtd.values) {
    return {
      nodeType: JtdNodeType.VALUES,
      valueNode: parseJtd(jtd.values),
      jtd,
    };
  }

  if (jtd.properties || jtd.optionalProperties) {

    const objectNode: IJtdObjectNode<Metadata> = {
      nodeType: JtdNodeType.OBJECT,
      properties: Object.create(null),
      optionalProperties: Object.create(null),
      jtd,
    };

    if (jtd.properties) {
      for (const [propKey, propJtd] of Object.entries(jtd.properties)) {
        objectNode.properties[propKey] = parseJtd(propJtd);
      }
    }
    if (jtd.optionalProperties) {
      for (const [propKey, propJtd] of Object.entries(jtd.optionalProperties)) {
        if (propKey in objectNode.properties) {
          throw new Error('Duplicated property: ' + propKey);
        }
        objectNode.optionalProperties[propKey] = parseJtd(propJtd);
      }
    }
    return objectNode;
  }

  if (jtd.discriminator && jtd.mapping) {

    const unionNode: IJtdUnionNode<Metadata> = {
      nodeType: JtdNodeType.UNION,
      discriminator: jtd.discriminator,
      mapping: Object.create(null),
      jtd,
    };

    for (const [mappingKey, mappingJtd] of Object.entries(jtd.mapping)) {
      const objectNode = parseJtd(mappingJtd);

      if (objectNode.nodeType !== JtdNodeType.OBJECT) {
        throw new TypeError('Mappings must be object definitions: ' + mappingKey);
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
