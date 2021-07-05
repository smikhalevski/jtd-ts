import {IJtdEnumNode, IJtdNode, IJtdTypeNode, IJtdUnionNode, JtdNode, JtdNodeType} from '../jtd-ast-types';
import {visitJtdNode} from '../jtd-visitor';
import {JtdType} from '../jtd-types';
import {compileAccessor, compileJsonPointer, createVarProvider, IPropertyRef} from '../ts-compile-utils';
import {pascalCase} from '../rename-utils';
import {RuntimeMethod, runtimeMethod} from './RuntimeMethod';

export const TYPE_VALIDATOR = '$Validator';
export const VAR_CACHE = '$validatorCache';

const ARG_VALUE = 'value';
const ARG_ERRORS = 'errors';
const ARG_POINTER = 'pointer';

const excludedVars = [ARG_VALUE, ARG_ERRORS, ARG_POINTER].concat(runtimeMethod);

/**
 * Returns source that maps fields exported from validation lib to internal names used by compiled validators. Lib
 * isn't used directly to allow code minification tools to effectively rename vars.
 *
 * @param libVar The name of the variable that holds validator library exports.
 */
export function compileValidatorModuleProlog(libVar: string): string {
  return `type ${TYPE_VALIDATOR}=${libVar}.Validator;`
  + `const {${runtimeMethod.join(',')}}=${libVar};`
      + `const ${VAR_CACHE}:Record<string,any>={};`;
}

export interface IValidatorOptions<Metadata> {

  /**
   * Returns the name of the emitted validator function.
   */
  renameValidator: (ref: string, node: IJtdNode<Metadata>) => string;

  /**
   * Returns the name of the checker function that should be used to check values of `type`.
   */
  renameTypeChecker: (type: JtdType | string, node: IJtdTypeNode<Metadata>) => string;

  /**
   * Returns the literal value of an enum that must rewrite the value declared in JTD.
   */
  rewriteEnumValue: (value: string, node: IJtdEnumNode<Metadata>) => string | number | undefined;

  /**
   * Returns the literal value of an enum that is used for mapping a discriminated union.
   */
  rewriteMappingKey: (mappingKey: string, unionRef: string, unionNode: IJtdUnionNode<Metadata>) => string | number | undefined;

  /**
   * If set to `true` then checker functions are emitted along with validators. Checkers are functions that should be
   * used for type refinement in TS.
   */
  emitsCheckers: boolean;

  /**
   * Returns the name of the emitted checker function. This is used if {@link emitsCheckers} is enabled.
   */
  renameChecker: (ref: string, node: IJtdNode<Metadata>) => string;

  /**
   * Returns the name of the interface, type or enum represented by the node. This is used if {@link emitsCheckers} is
   * enabled.
   */
  renameType: (ref: string, node: IJtdNode<Metadata>) => string;
}

/**
 * Returns source code of functions that validate JTD definitions.
 */
export function compileValidators<Metadata>(definitions: Map<string, JtdNode<Metadata>>, options?: Partial<IValidatorOptions<Metadata>>): string {
  const allOptions = {...jtdValidatorOptions, ...options};

  const {
    renameType,
    renameValidator,
    renameChecker,
    emitsCheckers,
  } = allOptions;

  let source = '';

  definitions.forEach((node, ref) => {
    source += `export const ${renameValidator(ref, node)}:${TYPE_VALIDATOR}=`
        + `(${ARG_VALUE},${ARG_ERRORS}=[],${ARG_POINTER}="")=>{`
        + compileValidatorBody(ref, node, allOptions)
        + `return ${ARG_ERRORS};};`;

    if (emitsCheckers) {
      source += `export const ${renameChecker(ref, node)}=`
          + `(${ARG_VALUE}:unknown):${ARG_VALUE} is ${renameType(ref, node)}=>`
          + renameValidator(ref, node) + '(' + ARG_VALUE + ').length===0;';
    }
  });

  return source;
}

/**
 * Compiles the body of the validator function.
 */
function compileValidatorBody<Metadata>(ref: string, node: JtdNode<Metadata>, options: IValidatorOptions<Metadata>): string {
  const {
    renameValidator,
    renameTypeChecker,
    rewriteEnumValue,
    rewriteMappingKey,
  } = options;

  let source = '';

  const nextVar = createVarProvider(excludedVars);
  const pointer: Array<IPropertyRef> = [];

  visitJtdNode(node, {

    ref(node) {
      source += compileCheckerCall(renameValidator(node.ref, node), pointer) + ';';
    },

    nullable(node, next) {
      source += `if(${ARG_VALUE + compileAccessor(pointer)}!==null){`;
      next();
      source += '}';
    },

    type(node) {
      const validatorName = renameTypeChecker(node.type, node);
      source += compileCheckerCall(validatorName, pointer) + ';';
    },

    enum(node) {
      const valuesSource = 'new Set(['
          + Array.from(node.values).map((value) => JSON.stringify(rewriteEnumValue(value, node))).join(',')
          + '])';
      source += compileCheckerCall(RuntimeMethod.CHECK_ENUM, pointer, compileCachedValue(ref, nextVar, valuesSource)) + ';';
    },

    elements(node, next) {
      if (node.elementNode.nodeType === JtdNodeType.ANY) {
        source += compileCheckerCall(RuntimeMethod.CHECK_ARRAY, pointer) + ';';
        return;
      }

      const indexVar = nextVar();
      source += `if(${compileCheckerCall(RuntimeMethod.CHECK_ARRAY, pointer)}){`
          + `for(let ${indexVar}=0;${indexVar}<${ARG_VALUE + compileAccessor(pointer)}.length;${indexVar}++){`;
      pointer.push({var: indexVar});
      next();
      pointer.pop();
      source += '}}';
    },

    values(node, next) {
      if (node.valueNode.nodeType === JtdNodeType.ANY) {
        source += compileCheckerCall(RuntimeMethod.CHECK_OBJECT, pointer) + ';';
        return;
      }

      const keyVar = nextVar();
      source += `if(${compileCheckerCall(RuntimeMethod.CHECK_OBJECT, pointer)}){`
          + `for(const ${keyVar} in ${ARG_VALUE + compileAccessor(pointer)}){`;
      pointer.push({var: keyVar});
      next();
      pointer.pop();
      source += '}}';
    },

    object(node, next) {
      source += `if(${compileCheckerCall(RuntimeMethod.CHECK_OBJECT, pointer)}){`;
      next();
      source += '}';
    },

    property(propKey, propNode, objectNode, next) {
      pointer.push({key: propKey});
      next();
      pointer.pop();
    },

    optionalProperty(propKey, propNode, objectNode, next) {
      pointer.push({key: propKey});
      source += `if(${ARG_VALUE + compileAccessor(pointer)}!==undefined){`;
      next();
      source += '}';
      pointer.pop();
    },

    union(node, next) {
      const discriminatorPointer = [...pointer, {key: node.discriminator}];
      source += `if(${compileCheckerCall(RuntimeMethod.CHECK_OBJECT, pointer)}){`
          + `switch(${ARG_VALUE + compileAccessor(discriminatorPointer)}){`;
      next();
      source += 'default:'
          + RuntimeMethod.RAISE_INVALID + '('
          + ARG_ERRORS + ','
          + ARG_POINTER + '+' + compileJsonPointer(discriminatorPointer, RuntimeMethod.ESCAPE_JSON_POINTER)
          + ');'
          + '}}';
    },

    unionMapping(mappingKey, mappingNode, unionNode, next) {
      source += `case ${JSON.stringify(rewriteMappingKey(mappingKey, ref, unionNode))}:`;
      next();
      source += 'break;';
    },
  });

  return source;
}

/**
 * Returns a validator function call site source code.
 *
 * @param checkerName The name of the checker function to call.
 * @param pointer The pointer to the validated property.
 * @param args Checker-specific required arguments.
 *
 * @example
 * compileCheckerCall('checkEnum', [{key: 'bar'}, {var: 'i'}], 'new Set(["AAA", "BBB"])')
 *     // → 'checkEnum(value.bar[i],new Set(["AAA", "BBB"]),errors,"/bar"+__escapeJsonPointer(i))'
 */
function compileCheckerCall(checkerName: string, pointer: Array<IPropertyRef>, ...args: Array<string>): string {
  const pointerSource = compileJsonPointer(pointer, RuntimeMethod.ESCAPE_JSON_POINTER);
  return checkerName + '('
      // value
      + ARG_VALUE + compileAccessor(pointer) + ','
      // args
      + (args.length ? args.join(',') + ',' : '')
      // errors
      + ARG_ERRORS + ','
      // pointer
      + (pointerSource ? ARG_POINTER + '+' + pointerSource : ARG_POINTER)
      + ')';
}

function compileCachedValue(ref: string, nextVar: () => string, valueSource: string): string {
  return VAR_CACHE + '[' + JSON.stringify(ref + '.' + nextVar()) + ']||=' + valueSource;
}

export const jtdValidatorOptions: IValidatorOptions<unknown> = {
  renameValidator: (ref) => 'validate' + pascalCase(ref),
  renameTypeChecker: (type, node) => jtdTypeCheckerMap[node.type as JtdType] || 'check' + pascalCase(type),
  rewriteEnumValue: (value) => value,
  rewriteMappingKey: (mappingKey) => mappingKey,

  emitsCheckers: false,
  renameChecker: (ref) => 'is' + pascalCase(ref),
  renameType: pascalCase,
};

export const jtdTypeCheckerMap: Record<JtdType, string> = {
  [JtdType.BOOLEAN]: RuntimeMethod.CHECK_BOOLEAN,
  [JtdType.STRING]: RuntimeMethod.CHECK_STRING,
  [JtdType.TIMESTAMP]: RuntimeMethod.CHECK_INTEGER,
  [JtdType.FLOAT32]: RuntimeMethod.CHECK_NUMBER,
  [JtdType.FLOAT64]: RuntimeMethod.CHECK_NUMBER,
  [JtdType.INT8]: RuntimeMethod.CHECK_INTEGER,
  [JtdType.UINT8]: RuntimeMethod.CHECK_INTEGER,
  [JtdType.INT16]: RuntimeMethod.CHECK_INTEGER,
  [JtdType.UINT16]: RuntimeMethod.CHECK_INTEGER,
  [JtdType.INT32]: RuntimeMethod.CHECK_INTEGER,
  [JtdType.UINT32]: RuntimeMethod.CHECK_INTEGER,
};
