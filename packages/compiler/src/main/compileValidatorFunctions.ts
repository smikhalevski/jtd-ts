import {IJtdNodeDict, IValidatorDialect, RefResolver} from '@jtdc/types';
import {compileTypeStatement, ITypeStatementCompilerConfig} from './compileTypeStatement';
import {compileValidatorFunction} from './compileValidatorFunction';

/**
 * Compiles provided JTD definitions as a TypeScript source.
 *
 * @template M The type of the JTD metadata.
 *
 * @param definitions Map from name to JTD node.
 * @param refResolver Returns a TypeScript type name referenced by node.
 * @param dialect The validator compilation dialect that describes how validators and type guards are compiled.
 * @returns The TypeScript source code with type, interface and enum definitions.
 */
export function compileValidatorFunctions<M, C>(definitions: IJtdNodeDict<M>, refResolver: RefResolver<M>, dialect: IValidatorDialect<M, C>): string {
  return Object.entries(definitions).reduce((src, [name, node]) => src + compileValidatorFunction(name, node, refResolver, dialect), '');
}
