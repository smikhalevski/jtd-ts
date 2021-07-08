import {IJtdEnumNode, IJtdMappingNode, IJtdPropertyNode, JtdNode, JtdNodeType, JtdNode} from '../jtd-ast-types';
import {visitJtdNode} from '../jtd-visitor';
import {JtdRefResolver} from '../jtd-ts';
import {createVarProvider} from '../compiler-utils';
import {pascalCase} from '../rename-utils';
import {checkerCompiler} from '../checker/compiler';

const ARG_VALUE = 'value';
const ARG_CONTEXT = 'ctx';
const ARG_POINTER = 'pointer';

export interface ICheckerOptions<M> {

  /**
   * Returns the new expression that wraps `src` so the result would be retained between checker invocations.
   *
   * @example
   * // The array would be initialized only once.
   * const src = wrapCache('["foo", "bar"]');
   *
   * return `(${src}).includes("foo")`;
   * // → '(b.x||=["foo", "bar"]).includes("foo")'
   */
  wrapCache: (src: string) => string;

  /**
   * Returns the new declared variable that can be referenced in an expression.
   *
   * @example
   * const aVar = nextVar(); // → 'x'
   * const bVar = nextVar(); // → 'y'
   *
   * return `${aVar}=…, ${bVar}=…, ${aVar} && ${bVar}`;
   * // → 'x=…, y=…, x && y'
   */
  nextVar: () => string;

  /**
   * The name of the variable that holds the context.
   */
  contextVar: string;

  /**
   * The expression that returns the currently validated value.
   */
  valueSrc: string;

  /**
   * The expression that returns the JSON pointer string of the currently validated value.
   */
  pointerSrc: string;
}

export interface ICheckerCompiler<M> {

  /**
   * The path of the module that exports the runtime as default.
   */
  runtimeModulePath: string;

  /**
   * Returns an expression of the checker invocation.
   */
  compileChecker: (node: JtdNode<M>, checkerOptions: ICheckerOptions<M>, validatorOptions: Required<IValidatorOptions<M>>) => string;
}

export interface IValidatorOptions<M> {

  checkerRuntimeVar?: string;

  validatorRuntimeVar?: string;

  /**
   * Returns the name of an object property.
   */
  renameProperty?: (node: IJtdPropertyNode<M>) => string;

  /**
   * Returns the name of the emitted validator function.
   */
  renameValidator?: (ref: string, node: JtdNode<M>) => string;

  /**
   * Compiler of runtime checker functions.
   */
  checkerCompiler?: ICheckerCompiler<M>;

  /**
   * Returns the literal value of an enum that must rewrite the value declared in JTD.
   */
  rewriteEnumValue?: (value: string, node: IJtdEnumNode<M>) => string | number | undefined;

  /**
   * Returns the literal value of an enum that is used for mapping a discriminated union.
   */
  rewriteMappingKey?: (unionRef: string, mappingNode: IJtdMappingNode<M>) => string | number | undefined;

  /**
   * If set to `true` then type narrowing functions are emitted along with validators.
   *
   * @see {@link https://www.typescriptlang.org/docs/handbook/2/narrowing.html TypeScript Narrowing}
   */
  emitsTypeNarrowing?: boolean;

  /**
   * Returns the name of the type narrowing function. This is used if {@link emitsTypeNarrowing} is enabled.
   */
  renameTypeNarrowing?: (ref: string, node: JtdNode<M>) => string;

  /**
   * If {@link emitsTypeNarrowing} is enabled then this callback is used to resolve a type name that
   * corresponds to the ref. If omitted then type narrowing functions would be emitted with `as unknown`.
   */
  resolveRef?: JtdRefResolver<M>;

  /**
   * If set to `true` then validator would traverse nodes that don't enforce any constraints.
   *
   * @default false
   */
  traversesAny?: boolean;
}

/**
 * Returns source code of functions that validate JTD definitions.
 */
export function compileValidators<M>(definitions: Record<string, JtdNode<M>>, options?: Partial<IValidatorOptions<M>>): string {
  const opts = Object.assign({}, jtdValidatorOptions, options);

  const {
    validatorRuntimeVar,
    renameValidator,
    renameTypeNarrowing,
    emitsTypeNarrowing,
    resolveRef,
  } = opts;

  let source = '';

  let exportedNames: Array<string> = [];

  for (const [ref, node] of Object.entries(definitions)) {
    const name = renameValidator(ref, node);
    exportedNames.push(name);

    source += `const ${name}:${validatorRuntimeVar}.Validator=`
        + `(${ARG_VALUE},${ARG_CONTEXT},${ARG_POINTER})=>{`
        + `${ARG_CONTEXT}||={};`
        + `${ARG_POINTER}||="";`
        + compileValidatorBody(ref, node, opts)
        + `return ${ARG_CONTEXT}.errors;`
        + '};';

    if (emitsTypeNarrowing) {
      const name = renameTypeNarrowing(ref, node);
      exportedNames.push(name);

      source += `const ${name}=`
          + `(${ARG_VALUE}:unknown):${ARG_VALUE} is ${resolveRef(ref, node)}=>!`
          + renameValidator(ref, node) + '(' + ARG_VALUE + ')?.length;';
    }
  }

  source += `export {${exportedNames.join(',')}};`;

  return source;
}

export function compileValidatorBody<M>(ref: string, node: JtdNode<M>, options: Required<IValidatorOptions<M>>): string {
  const {
    rewriteMappingKey,
    checkerCompiler,
    renameValidator,
    traversesAny,
  } = options;

  let src = '';

  const {compileChecker} = checkerCompiler;

  const nextVar = createVarProvider();

  let cacheVar: string | undefined;

  const valueVars: Array<string> = [ARG_VALUE];

  let pointer: string | { var: string } | undefined;
  let index = 0;
  let valueSrc = ARG_VALUE;

  const checkerOptions: ICheckerOptions<M> = {
    wrapCache: (src1: string) => {
      if (cacheVar == null) {
        cacheVar = nextVar();
        src = cacheVar + '=' + renameValidator(ref, node) + '.cache||={};';
      }
      return cacheVar + '.' + nextVar() + '||=' + src1;
    },
    nextVar,
    contextVar: ARG_CONTEXT,
    valueSrc: ARG_VALUE,
    pointerSrc: ARG_POINTER,
  };

  const compileVars = () => {
    if (!pointer) {
      return '';
    }
    index++;
    const valueVar = valueVars[index] ||= nextVar();
    const source = `${valueVar}=${valueSrc};`;
    valueSrc = valueVar;
    return source;
  };
  const enterScope = (p: string | { var: string }) => {
    pointer = p;
    valueSrc += typeof pointer === 'string' ? '.' + pointer : `[${pointer.var}]`;
  };
  const exitScope = () => {
    if (!pointer) {
      index--;
    }
    pointer = undefined;
    valueSrc = valueVars[index];
  };

  visitJtdNode(node, {

    any() {
      src += compileChecker(node, checkerOptions, options) + ';';
    },

    ref() {
      src += compileChecker(node, checkerOptions, options) + ';';
    },

    nullable(node, next) {
      if (!traversesAny && isAnyNode(node.valueNode)) {
        return;
      }
      src += compileVars()
          + `if(${compileChecker(node, checkerOptions, options)}){`;
      next();
      src += '}';
    },

    type() {
      src += compileChecker(node, checkerOptions, options) + ';';
    },

    enum() {
      src += compileChecker(node, checkerOptions, options) + ';';
    },

    elements(node, next) {
      if (!traversesAny && isAnyNode(node.elementNode)) {
        src += compileChecker(node, checkerOptions, options) + ';';
        return;
      }

      const indexVar = nextVar();
      src += `if(${compileChecker(node, checkerOptions, options)}){`
          + `for(let ${indexVar}=0;${indexVar}<${valueSrc}.length;${indexVar}++){`;
      enterScope({var: indexVar});
      next();
      exitScope();
      src += '}}';
    },

    values(node, next) {
      if (!traversesAny && isAnyNode(node.valueNode)) {
        src += compileChecker(node, checkerOptions, options) + ';';
        return;
      }

      const keyVar = nextVar();
      src += `if(${compileChecker(node, checkerOptions, options)}){`
          + `for(const ${keyVar} in ${valueSrc}){`;
      enterScope({var: keyVar});
      next();
      exitScope();
      src += '}}';
    },

    object(node, next) {
      if (!traversesAny && node.propertyNodes.every(isAnyNode)) {
        src += compileChecker(node, checkerOptions, options) + ';';
        return;
      }
      src += compileVars()
          + `if(${compileChecker(node, checkerOptions, options)}){`;
      next();
      src += '}';
    },

    property(node, next) {
      if (!traversesAny && isAnyNode(node)) {
        return;
      }
      enterScope(node.key);
      if (node.optional) {
        src += compileVars()
            + `if(${compileChecker(node, checkerOptions, options)}){`;
        next();
        src += '}';
      } else {
        next();
      }
      exitScope();
    },

    union(node, next) {
      src += compileVars()
          + `if(${compileChecker(node, checkerOptions, options)}){`
          + `switch(${valueSrc + node.discriminator}){`;
      next();
      src += 'default:'
          + 'raiseInvalid()'
          + '}}';
    },

    mapping(node, next) {
      src += `case ${JSON.stringify(rewriteMappingKey(ref, node))}:`;
      next();
      src += 'break;';
    },
  });

  return src;
}

/**
 * Returns `true` if `node` doesn't enforce any constraints.
 */
function isAnyNode<M>(node: JtdNode<M>): boolean {
  switch (node.nodeType) {

    case JtdNodeType.ANY:
      return true;

    case JtdNodeType.PROPERTY:
    case JtdNodeType.NULLABLE:
      return isAnyNode(node.valueNode);

    default:
      return false;
  }
}

export const jtdValidatorOptions: Required<IValidatorOptions<any>> = {
  checkerRuntimeVar: 'r',
  validatorRuntimeVar: 'v',
  renameProperty: (node) => node.key,
  renameValidator: (ref) => 'validate' + pascalCase(ref),
  checkerCompiler,
  rewriteEnumValue: (value) => value,
  rewriteMappingKey: (mappingKey) => mappingKey,
  emitsTypeNarrowing: false,
  renameTypeNarrowing: (ref) => 'is' + pascalCase(ref),
  resolveRef: (ref) => 'unknown',
  traversesAny: false,
};
