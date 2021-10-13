import {IJtdNodeDict, IJtdRoot} from '@jtdc/types';
import {createMap} from './misc';
import {parseJtd} from './parseJtd';
import {parseJtdDefinitions} from './parseJtdDefinitions';

/**
 * Converts JTD and its dependencies to a map of nodes where key is `name` and value is a parsed node.
 *
 * @template M The type of the JTD metadata.
 *
 * @param name The JTD definition name.
 * @param jtdRoot The JTD to parse.
 * @returns The map from a definition name to a parsed node.
 */
export function parseJtdRoot<M>(name: string, jtdRoot: IJtdRoot<M>): IJtdNodeDict<M> {
  const nodes = jtdRoot.definitions ? parseJtdDefinitions(jtdRoot.definitions) : createMap();
  nodes[name] = parseJtd(jtdRoot);
  return nodes;
}
