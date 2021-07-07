import {
  IJtdEnumNode,
  IJtdNodeMap,
  IJtdObjectNode,
  IJtdTypeNode,
  IJtdUnionNode,
  JtdNode,
  JtdNodeType,
} from '../jtd-ast-types';
import {visitJtdNode} from '../jtd-visitor';
import {JtdType} from '../jtd-types';
import {compileAccessor, compileJsonPointer, createVarProvider, IPropertyRef, isEqualRef} from '../compiler-utils';
import {pascalCase} from '../rename-utils';
import {RuntimeMethod, runtimeMethod, TYPE_VALIDATOR, VAR_CACHE, VAR_RUNTIME} from './runtime-naming';
import {JtdRefResolver} from '../jtd-ts';

const ARG_VALUE = 'value';
const ARG_ERRORS = 'errors';
const ARG_POINTER = 'pointer';
const ARG_EXCLUDED = 'excluded';

const excludedVars = [ARG_VALUE, ARG_ERRORS, ARG_POINTER, TYPE_VALIDATOR, VAR_CACHE, VAR_RUNTIME].concat(runtimeMethod);

/**
 * Returns source that maps fields exported from validation runtime to internal names used by compiled validators.
 * Runtime isn't used directly to allow code minification tools to effectively rename vars.
 *
 * @param runtimeVar The name of the variable that holds validator library exports.
 */
export function compileValidatorModuleProlog(runtimeVar: string): string {
  return `const {${runtimeMethod.join(',')}}=${runtimeVar};`
      + `const ${VAR_CACHE}:Record<string,any>=Object.create(null);`;
}

export interface IValidatorOptions<M> {

  /**
   * Returns the name of an object property.
   */
  renameProperty?: (propKey: string, node: JtdNode<M>, objectNode: IJtdObjectNode<M>) => string;

  /**
   * Returns the name of the emitted validator function.
   */
  renameValidator?: (ref: string, node: JtdNode<M>) => string;

  /**
   * Returns the name of the checker function that should be used to check values of `type`.
   */
  renameTypeChecker?: (type: JtdType | string, node: IJtdTypeNode<M>) => string;

  /**
   * Returns the literal value of an enum that must rewrite the value declared in JTD.
   */
  rewriteEnumValue?: (value: string, node: IJtdEnumNode<M>) => string | number | undefined;

  /**
   * Returns the literal value of an enum that is used for mapping a discriminated union.
   */
  rewriteMappingKey?: (mappingKey: string, unionRef: string, unionNode: IJtdUnionNode<M>) => string | number | undefined;

  /**
   * If set to `true` then checker functions are emitted along with validators. Checkers are functions that should be
   * used for type refinement in TS.
   */
  emitsCheckers?: boolean;

  /**
   * Returns the name of the emitted checker function. This is used if {@link emitsCheckers} is enabled.
   */
  renameChecker?: (ref: string, node: JtdNode<M>) => string;

  /**
   * If {@link emitsCheckers} is enabled then this callback is used to resolve a type name that corresponds to the ref.
   * If omitted then type checkers would be emitted with `as unknown`.
   */
  resolveRef?: JtdRefResolver<M>;
}

/**
 * Returns source code of functions that validate JTD definitions.
 */
export function compileValidators<M>(definitions: IJtdNodeMap<M>, options?: Partial<IValidatorOptions<M>>): string {
  const opts = Object.assign({}, jtdValidatorOptions, options);

  const {
    renameValidator,
    renameChecker,
    emitsCheckers,
    resolveRef,
  } = opts;

  let source = '';

  let aaa: Array<string> = [];

  for (const [ref, node] of Object.entries(definitions)) {
    const name = renameValidator(ref, node);
    aaa.push(name);

    source += `const ${name}:${TYPE_VALIDATOR}=`
        + `(${ARG_VALUE},${ARG_ERRORS},${ARG_POINTER},${ARG_EXCLUDED})=>{`
        + `${ARG_ERRORS}||=[];`
        + `${ARG_POINTER}||="";`
        + `${ARG_EXCLUDED}||=[];`
        + compileValidatorBody(ref, node, opts)
        + `return ${ARG_ERRORS};`
        + '};';

    if (emitsCheckers) {
      const name = renameChecker(ref, node);
      aaa.push(name);

      source += `const ${name}=`
          + `(${ARG_VALUE}:unknown):${ARG_VALUE} is ${resolveRef(ref, node)}=>!`
          + renameValidator(ref, node) + '(' + ARG_VALUE + ').length;';
    }
  }

  source += `export {${aaa.join(',')}};`;

  return source;
}

/**
 * Compiles the body of the validator function.
 */
function compileValidatorBody<M>(ref: string, node: JtdNode<M>, options: Required<IValidatorOptions<M>>): string {
  const {
    renameProperty,
    renameValidator,
    renameTypeChecker,
    rewriteEnumValue,
    rewriteMappingKey,
  } = options;

  let source = '';

  // Returns the next variable name
  const nextVar = createVarProvider(excludedVars);

  // Current pointer in ARV_VALUE variable
  const pointer: Array<IPropertyRef> = [];

  interface IEntry {
    pointer: Array<IPropertyRef>,
    valueVar: string,
    pointerVar: string
  }

  let pointerVar = ARG_POINTER;
  let valueVar = ARG_VALUE;

  const pointerVars: Array<IEntry> = [];

  const compileValueVar = () => {

    if (pointer.length === 0) {
      pointerVar = ARG_POINTER;
      valueVar = ARG_VALUE;
      return '';
    }

    let e: IEntry | undefined;
    let o = -1;

    for (const entry of pointerVars) {
      if (entry.pointer.length <= pointer.length) {
        for (let i = 0; i < entry.pointer.length; i++) {
          if (isEqualRef(entry.pointer[i], pointer[i]) && i > o) {
            e = entry;
            o = i;
          }
        }
      }
    }

    let p;

    if (e) {
      if (pointer.length === o + 1) {
        pointerVar = e.pointerVar;
        valueVar = e.valueVar;
        return '';
      }

      p = pointer.slice(o + 1);
    } else {
      p = pointer;
    }

    pointerVar = nextVar();
    valueVar = nextVar();

    pointerVars.push({pointer: pointer.slice(0), pointerVar: pointerVar, valueVar});

    return `const ${valueVar}=${e ? e.valueVar : ARG_VALUE}${compileAccessor(p)};`
        + `const ${pointerVar}=${e ? e.pointerVar : ARG_POINTER}+${compileJsonPointer(p, RuntimeMethod.ESCAPE_JSON_POINTER)};`;
  };

  visitJtdNode(node, {

    visitRef(node) {
      source += compileValidatorCall(renameValidator(node.ref, node), valueVar, pointerVar) + ';';
    },

    visitNullable(node, next) {
      source += compileValueVar()
          + `if(${valueVar}!==null){`;
      next();
      source += '}';
    },

    visitType(node) {
      const validatorName = renameTypeChecker(node.type, node);
      source += compileCheckerCall(validatorName, valueVar, pointerVar) + ';';
    },

    visitEnum(node) {
      const valuesSource = '['
          + Array.from(node.values).map((value) => JSON.stringify(rewriteEnumValue(value, node))).join(',')
          + ']';
      source += compileCheckerCall(RuntimeMethod.CHECK_ENUM, valueVar, pointerVar, compileCachedValue(ref, nextVar, valuesSource)) + ';';
    },

    visitElements(node, next) {
      if (node.elementNode.nodeType === JtdNodeType.ANY) {
        source += compileCheckerCall(RuntimeMethod.CHECK_ARRAY, valueVar, pointerVar) + ';';
        return;
      }

      const indexVar = nextVar();
      source += compileValueVar()
          + `if(${compileCheckerCall(RuntimeMethod.CHECK_ARRAY, valueVar, pointerVar)} && ${RuntimeMethod.EXCLUDE}(${ARG_EXCLUDED},${valueVar})){`
          + `for(let ${indexVar}=0;${indexVar}<${valueVar}.length;${indexVar}++){`;
      pointer.push({var: indexVar});
      source += compileValueVar();
      next();
      pointer.pop();
      source += '}}';
    },

    visitValues(node, next) {
      if (node.valueNode.nodeType === JtdNodeType.ANY) {
        source += compileCheckerCall(RuntimeMethod.CHECK_OBJECT, valueVar, pointerVar) + ';';
        return;
      }

      const keyVar = nextVar();
      source += compileValueVar()
          + `if(${compileCheckerCall(RuntimeMethod.CHECK_OBJECT, valueVar, pointerVar)} && ${RuntimeMethod.EXCLUDE}(${ARG_EXCLUDED},${valueVar})){`
          + `for(const ${keyVar} in ${valueVar}){`;
      pointer.push({var: keyVar});
      source += compileValueVar();
      next();
      pointer.pop();
      source += '}}';
    },

    visitObject(node, next) {
      source += compileValueVar()
          + `if(${compileCheckerCall(RuntimeMethod.CHECK_OBJECT, valueVar, pointerVar)} && ${RuntimeMethod.EXCLUDE}(${ARG_EXCLUDED},${valueVar})){`;
      next();
      source += '}';
    },

    visitProperty(propKey, propNode, objectNode, next) {
      pointer.push({key: renameProperty(propKey, propNode, objectNode)});
      source += compileValueVar();
      next();
      pointer.pop();
    },

    visitOptionalProperty(propKey, propNode, objectNode, next) {
      pointer.push({key: renameProperty(propKey, propNode, objectNode)});
      source += compileValueVar()
          + `if(${valueVar}!==undefined){`;
      next();
      source += '}';
      pointer.pop();
    },

    visitUnion(node, next) {
      source += compileValueVar()
          + `if(${compileCheckerCall(RuntimeMethod.CHECK_OBJECT, valueVar, pointerVar)} && ${RuntimeMethod.EXCLUDE}(${ARG_EXCLUDED},${valueVar})){`
          + `switch(${valueVar + compileAccessor([{key: node.discriminator}])}){`;
      next();
      source += 'default:'
          + RuntimeMethod.RAISE_INVALID + '('
          + ARG_ERRORS + ','
          + ARG_POINTER + '+' + compileJsonPointer(pointer.concat({key: node.discriminator}), RuntimeMethod.ESCAPE_JSON_POINTER)
          + ');'
          + '}}';
    },

    visitUnionMapping(mappingKey, mappingNode, unionNode, next) {
      source += `case ${JSON.stringify(rewriteMappingKey(mappingKey, ref, unionNode))}:`;
      next();
      source += 'break;';
    },
  });

  return source;
}

/**
 * Returns a validator function call site source code.
 */
function compileValidatorCall(validatorName: string, valueVar: string, pointerVar: string): string {
  return validatorName + '('
      // value
      + valueVar + ','
      // errors
      + ARG_ERRORS + ','
      // pointer
      + pointerVar + ','
      // excluded
      + ARG_EXCLUDED
      + ')';
}

/**
 * Returns a checker function call site source code.
 */
function compileCheckerCall(checkerName: string, valueVar: string, pointerVar: string, ...args: Array<string>): string {
  return checkerName + '('
      // value
      + valueVar + ','
      // args
      + (args.length ? args.join(',') + ',' : '')
      // errors
      + ARG_ERRORS + ','
      // pointer
      + pointerVar
      + ')';
}

function compileCachedValue(ref: string, nextVar: () => string, valueSource: string): string {
  return VAR_CACHE + '[' + JSON.stringify(ref + '.' + nextVar()) + ']||=' + valueSource;
}

export const jtdValidatorOptions: Required<IValidatorOptions<any>> = {
  renameProperty: (propKey) => propKey,
  renameValidator: (ref) => 'validate' + pascalCase(ref),
  renameTypeChecker: (type, node) => jtdTypeCheckerMap[node.type as JtdType] || 'check' + pascalCase(type),
  rewriteEnumValue: (value) => value,
  rewriteMappingKey: (mappingKey) => mappingKey,

  emitsCheckers: false,
  renameChecker: (ref) => 'is' + pascalCase(ref),
  resolveRef: (ref) => 'unknown',
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
