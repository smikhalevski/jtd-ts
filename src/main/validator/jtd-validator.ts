import {visitJtdNode} from '../jtd-visitor';
import {JtdRefResolver} from '../jtd-ts';
import {compilePropertyAccessor, createVarProvider} from '../compiler-utils';
import {pascalCase} from '../rename-utils';
import jtdCheckerCompiler from '../checker';
import {IJtdEnumNode, IJtdObjectNode, IJtdUnionNode, JtdNode, JtdNodeType} from '../jtd-ast-types';
import {ValidatorRuntimeKey} from './runtime';
import JsonPointer from 'json-pointer';

const ARG_VALUE = 'value';
const ARG_CONTEXT = 'ctx';
const ARG_POINTER = 'pointer';

export interface ICheckerCompilerOptions<M> {

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
  compileChecker: (node: JtdNode<M>, checkerOptions: ICheckerCompilerOptions<M>, validatorOptions: Required<IValidatorCompilerOptions<M>>) => string;
}

export interface IValidatorCompilerOptions<M> {

  /**
   * The compiler that describes how checkers are invoked by validators.
   *
   * @default {@link jtdCheckerCompiler}
   */
  checkerCompiler?: ICheckerCompiler<M>;

  /**
   * The name of the variable that holds the checker runtime.
   */
  checkerRuntimeVar?: string;

  /**
   * The name of the variable that holds the validator runtime.
   */
  validatorRuntimeVar?: string;

  /**
   * Returns the name of the emitted validator function.
   */
  renameValidator?: (ref: string, node: JtdNode<M>) => string;

  /**
   * Returns the name of an object property.
   */
  renamePropertyKey?: (propKey: string, propNode: JtdNode<M>, objectNode: IJtdObjectNode<M>) => string;

  /**
   * Returns the name of the union discriminator property.
   */
  renameDiscriminatorKey?: (node: IJtdUnionNode<M>) => string;

  /**
   * Returns the contents of the enum value.
   */
  rewriteEnumValue?: (value: string, node: IJtdEnumNode<M>) => string | number | undefined;

  /**
   * Returns the string value that would be used as a value of discriminator property in united interfaces.
   */
  rewriteMappingKey?: (mappingKey: string, mappingNode: IJtdObjectNode<M>, unionRef: string | undefined, unionNode: IJtdUnionNode<M>) => string | number | undefined;

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
  traversesUnconstrained?: boolean;
}

/**
 * Returns source code of functions that validate JTD definitions.
 */
export function compileValidators<M>(definitions: Record<string, JtdNode<M>>, options?: Partial<IValidatorCompilerOptions<M>>): string {
  const opts = Object.assign({}, jtdValidatorOptions, options);

  const {
    validatorRuntimeVar,
    renameValidator,
    emitsTypeNarrowing,
    renameTypeNarrowing,
    resolveRef,
  } = opts;

  let src = '';

  let exportedNames: Array<string> = [];

  for (const [ref, node] of Object.entries(definitions)) {
    const name = renameValidator(ref, node);
    exportedNames.push(name);

    src += `const ${name}:Validator=`
        + `(${ARG_VALUE},${ARG_CONTEXT},${ARG_POINTER})=>{`
        + `${ARG_CONTEXT}||={};`
        + `${ARG_POINTER}||="";`
        + compileValidatorBody(ref, node, opts)
        + `return ${ARG_CONTEXT}.errors;`
        + '};';

    if (emitsTypeNarrowing) {
      const name = renameTypeNarrowing(ref, node);
      exportedNames.push(name);

      src += `const ${name}=`
          + `(${ARG_VALUE}:unknown):${ARG_VALUE} is ${resolveRef(ref, node)}=>!`
          + renameValidator(ref, node) + '(' + ARG_VALUE + ',{lazy:true});';
    }
  }

  src += `export{${exportedNames.join(',')}};`;

  return src;
}

export function compileValidatorBody<M>(ref: string, node: JtdNode<M>, options: Required<IValidatorCompilerOptions<M>>): string {
  const {
    checkerRuntimeVar,
    validatorRuntimeVar,
    checkerCompiler: {compileChecker},
    renameValidator,
    renameDiscriminatorKey,
    rewriteMappingKey,
    traversesUnconstrained,
  } = options;

  let src = '';

  const declaredVars = new Set<string>();

  const nextVar = createVarProvider([
    ARG_VALUE,
    ARG_CONTEXT,
    ARG_POINTER,
    checkerRuntimeVar,
    validatorRuntimeVar,
  ]);

  // Validator cache variable
  let cacheVar: string | undefined;

  // Stacks of vars
  const valueVars: Array<string> = [ARG_VALUE];
  const pointerVars: Array<string> = [ARG_POINTER];

  // Index in stack
  let index = 0;

  // Current value and pointer accessors
  let valueSrc = ARG_VALUE;
  let pointerSrc = ARG_POINTER;

  const checkerOptions: ICheckerCompilerOptions<M> = {

    wrapCache(cachedSrc) {
      if (!cacheVar) {
        cacheVar = nextVar();
      }
      return cacheVar + '.' + nextVar() + '||=' + cachedSrc;
    },

    nextVar() {
      const customVar = nextVar();
      declaredVars.add(customVar);
      return customVar;
    },

    contextVar: ARG_CONTEXT,
    valueSrc,
    pointerSrc,
  };

  let propertyPending = false;

  const compileVars = () => {
    if (!propertyPending) {
      return '';
    }

    propertyPending = false;

    index++;

    const valueVar = valueVars[index] ||= nextVar();
    const pointerVar = pointerVars[index] ||= nextVar();

    declaredVars.add(valueVar);
    declaredVars.add(pointerVar);

    const source = `${valueVar}=${valueSrc};`
        + `${pointerVar}=${pointerSrc};`;

    valueSrc = valueVar;
    pointerSrc = pointerVar;

    checkerOptions.valueSrc = valueSrc;
    checkerOptions.pointerSrc = pointerSrc;

    return source;
  };

  const enterPropertyByKey = (propKey: string): void => {
    propertyPending = true;

    valueSrc += compilePropertyAccessor(propKey);
    pointerSrc += '+' + JSON.stringify('/' + JsonPointer.escape(propKey));

    checkerOptions.valueSrc = valueSrc;
    checkerOptions.pointerSrc = pointerSrc;
  };

  const enterPropertyByVar = (propVar: string, escapeRequired: boolean): void => {
    propertyPending = true;
    valueSrc += '[' + propVar + ']';

    if (escapeRequired) {
      pointerSrc += `+"/"+${validatorRuntimeVar}.${ValidatorRuntimeKey.ESCAPE_JSON_POINTER}(${propVar})`;
    } else {
      pointerSrc += `+"/"+${propVar}`;
    }

    checkerOptions.valueSrc = valueSrc;
    checkerOptions.pointerSrc = pointerSrc;
  };

  const exitProperty = () => {
    if (!propertyPending) {
      index--;
    }
    propertyPending = false;

    valueSrc = valueVars[index];
    pointerSrc = pointerVars[index];

    checkerOptions.valueSrc = valueSrc;
    checkerOptions.pointerSrc = pointerSrc;
  };

  visitJtdNode(node, {

    any(node) {
      if (!traversesUnconstrained) {
        return;
      }
      src += compileChecker(node, checkerOptions, options) + ';';
    },

    ref(node) {
      src += compileChecker(node, checkerOptions, options) + ';';
    },

    nullable(node, next) {
      if (!traversesUnconstrained && isUnconstrainedNode(node.valueNode)) {
        return;
      }
      src += compileVars()
          + `if(${compileChecker(node, checkerOptions, options)}){`;
      next();
      src += '}';
    },

    type(node) {
      src += compileChecker(node, checkerOptions, options) + ';';
    },

    enum(node) {
      src += compileChecker(node, checkerOptions, options) + ';';
    },

    elements(node, next) {
      if (!traversesUnconstrained && isUnconstrainedNode(node.elementNode)) {
        src += compileChecker(node, checkerOptions, options) + ';';
        return;
      }

      const indexVar = nextVar();
      src += compileVars()
          + `if(${compileChecker(node, checkerOptions, options)}){`
          + `for(let ${indexVar}=0;${indexVar}<${valueSrc}.length;${indexVar}++){`;
      enterPropertyByVar(indexVar, false);
      next();
      exitProperty();
      src += '}}';
    },

    values(node, next) {
      if (!traversesUnconstrained && isUnconstrainedNode(node.valueNode)) {
        src += compileChecker(node, checkerOptions, options) + ';';
        return;
      }

      const keyVar = nextVar();
      src += compileVars()
          + `if(${compileChecker(node, checkerOptions, options)}){`
          + `for(const ${keyVar} in ${valueSrc}){`;
      enterPropertyByVar(keyVar, true);
      next();
      exitProperty();
      src += '}}';
    },

    object(node, next) {
      if (
          !traversesUnconstrained
          && Object.values(node.properties).every(isUnconstrainedNode)
          && Object.values(node.optionalProperties).every(isUnconstrainedNode)
      ) {
        src += compileChecker(node, checkerOptions, options) + ';';
        return;
      }
      src += compileVars()
          + `if(${compileChecker(node, checkerOptions, options)}){`;
      next();
      src += '}';
    },

    property(propKey, propNode, objectNode, next) {
      if (!traversesUnconstrained && isUnconstrainedNode(propNode)) {
        return;
      }
      enterPropertyByKey(propKey);
      next();
      exitProperty();
    },

    optionalProperty(propKey, propNode, objectNode, next) {
      if (!traversesUnconstrained && isUnconstrainedNode(propNode)) {
        return;
      }
      enterPropertyByKey(propKey);
      src += compileVars();
      src += `if(${valueSrc}!==undefined){`;
      next();
      src += '}';
      exitProperty();
    },

    union(node, next) {
      const discriminatorKey = renameDiscriminatorKey(node);
      src += compileVars()
          + `if(${compileChecker(node, checkerOptions, options)}){`
          + `switch(${valueSrc + compilePropertyAccessor(discriminatorKey)}){`;
      next();
      src += 'default:'
          + `${validatorRuntimeVar}.${ValidatorRuntimeKey.RAISE_INVALID}(${ARG_CONTEXT},${pointerSrc}+${JSON.stringify('/' + JsonPointer.escape(discriminatorKey))})`
          + '}}';
    },

    mapping(mappingKey, mappingNode, unionNode, next) {
      src += `case ${JSON.stringify(rewriteMappingKey(mappingKey, mappingNode, ref, unionNode))}:`;
      next();
      src += 'break;';
    },
  });

  if (declaredVars.size) {
    src = 'let ' + Array.from(declaredVars).join(',') + ';' + src;
  }
  if (cacheVar) {
    src = 'let ' + cacheVar + '=' + renameValidator(ref, node) + '.' + ValidatorRuntimeKey.VALIDATOR_CACHE + '||={};' + src;
  }

  return src;
}

/**
 * Returns `true` if `node` doesn't enforce any constraints.
 */
function isUnconstrainedNode<M>(node: JtdNode<M>): boolean {
  return node.nodeType === JtdNodeType.ANY || node.nodeType === JtdNodeType.NULLABLE && isUnconstrainedNode(node.valueNode);
}

export const jtdValidatorOptions: Required<IValidatorCompilerOptions<any>> = {
  checkerCompiler: jtdCheckerCompiler,
  checkerRuntimeVar: 'c',
  validatorRuntimeVar: 'v',
  renameValidator: (ref) => 'validate' + pascalCase(ref),
  renamePropertyKey: (propKey) => propKey,
  rewriteEnumValue: (value) => value,
  renameDiscriminatorKey: (node) => node.discriminator,
  rewriteMappingKey: (mappingKey) => mappingKey,
  emitsTypeNarrowing: false,
  renameTypeNarrowing: (ref) => 'is' + pascalCase(ref),
  resolveRef: (ref) => {
    throw new Error('Unresolved reference: ' + ref);
  },
  traversesUnconstrained: false,
};
