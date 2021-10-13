import {IJtdDict, IJtdNodeDict, JtdNode} from '@jtdc/types';
import {createMap} from './misc';
import {parseJtd} from './parseJtd';

/**
 * Converts JTD dependencies to a map of nodes where key is `ref` and value is a parsed node.
 *
 * @template M The type of the JTD metadata.
 *
 * @param jtdDefinitions The dictionary of ref-JTD pairs.
 * @returns The map from ref to a parsed node.
 */
export function parseJtdDefinitions<M>(jtdDefinitions: IJtdDict<M>): IJtdNodeDict<M> {
  const nodes = createMap<JtdNode<M>>();

  for (const [name, jtd] of Object.entries(jtdDefinitions)) {
    nodes[name] = parseJtd(jtd);
  }
  return nodes;
}
