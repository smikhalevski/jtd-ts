import {IJtdNodeDict, RefResolver} from '@jtdc/types';
import {compileTypeStatement, ITypeStatementCompilerConfig} from './compileTypeStatement';

/**
 * Compiles provided JTD definitions as a TypeScript source.
 *
 * @template M The type of the JTD metadata.
 *
 * @param definitions Map from name to JTD node.
 * @param refResolver Returns a TypeScript type name referenced by node.
 * @param config The compilation options.
 * @returns The TypeScript source code with type, interface and enum definitions.
 */
export function compileTypeDefinitions<M>(definitions: IJtdNodeDict<M>, refResolver: RefResolver<M>, config: ITypeStatementCompilerConfig<M>): string {
  return Object.entries(definitions).reduce((src, [name, node]) => src + compileTypeStatement(name, node, refResolver, config), '');
}
