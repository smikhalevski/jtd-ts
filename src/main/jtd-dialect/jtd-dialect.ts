import {
  cg,
  collectVarRefs,
  compilePropertyAccessor,
  encodeLetters,
  IFragmentCgNode,
  IVarRefCgNode,
  optimizeChildren,
  pascalCase,
} from '@smikhalevski/codegen';
import {JtdNode, JtdNodeType} from '../jtd-ast-types';
import {JtdType} from '../jtd-types';
import {die} from '../misc';
import * as runtime from './runtime';
import {escapeJsonPointer} from './runtime';
import {IJtdcDialect, IJtdcDialectOptions} from '../dialect-types';

const RUNTIME_VAR = '_r';

/**
 * Context used by the dialect during validator compilation.
 */
export interface IJtdDialectContext {

  /**
   * Wraps an expression so result is retained between validator invocations.
   */
  warpCache: (frag: IFragmentCgNode) => IFragmentCgNode;
  valueVar: IVarRefCgNode;
  ctxVar: IVarRefCgNode;
  pointerVar: IVarRefCgNode;
}

/**
 * Creates a validator compilation dialect that renders validators which follow the JTD specification.
 */
export default function createJtdDialect<M>(options?: IJtdcDialectOptions<M>): IJtdcDialect<M, IJtdDialectContext> {
  const opt = {...jtdDialectOptions, ...options};

  const {
    renameValidator,
    renamePropertyKey,
    renameDiscriminatorKey,
    rewriteEnumValue,
    rewriteMappingKey,
    renameTypeGuard,
    renameType,
  } = opt;

  return {

    import() {
      return cg`import*as ${RUNTIME_VAR} from"jtdc/lib/jtd-dialect/runtime";`;
    },

    typeGuard(ref, node) {
      const name = renameTypeGuard(ref, node);

      return cg(
          cg`const ${name}=(value:unknown):value is ${renameType(ref, node)}=>!${renameValidator(ref, node)}(value,{shallow:true});`,
          cg`export{${name}};`,
      );
    },

    validator(ref, node, next) {
      const valueVar = cg.var();
      const ctxVar = cg.var();
      const pointerVar = cg.var();
      const cacheVar = cg.var();
      const name = renameValidator(ref, node);

      let cacheSize = 0;

      const bodyFrag = cg(
          cg.let(ctxVar, cg`${ctxVar}||{}`, true),
          cg.let(pointerVar, cg`${pointerVar}||""`),
          cg.let(cacheVar, cg`(${name}.cache||={})`),
          next({
            warpCache: (frag: IFragmentCgNode) => cg`${cacheVar}.${encodeLetters(cacheSize++)}||=${frag}`,
            valueVar,
            ctxVar,
            pointerVar,
          }),
          cg`return ${ctxVar}.errors;`,
      );

      optimizeChildren(bodyFrag.children);

      const undeclaredVars = collectVarRefs(bodyFrag, [valueVar, ctxVar, pointerVar]);

      return cg(
          cg.block`const ${name}:${RUNTIME_VAR}.Validator=(${valueVar},${ctxVar},${pointerVar})=>{${cg(
              undeclaredVars.length !== 0 && cg`let ${cg.join(undeclaredVars, ',')};`,
              bodyFrag,
          )}};`,
          cg`export{${name}};`,
      );
    },

    ref(node, ctx) {
      return cg`${renameValidator(node.ref, node)}(${ctx.valueVar},${ctx.ctxVar},${ctx.pointerVar});`;
    },

    nullable(node, ctx, next) {
      if (isUnconstrainedNode(node.valueNode)) {
        return cg``;
      }
      return cg.block`if(${ctx.valueVar}!==null){${
          next(ctx)
      }}`;
    },

    type(node, ctx) {
      const typeCheckerName = jtdTypeCheckerMap[node.type] || die('Unknown type: ' + node.type);
      return cg`${RUNTIME_VAR}.${typeCheckerName}(${ctx.valueVar},${ctx.ctxVar},${ctx.pointerVar});`;
    },

    enum(node, ctx) {
      const valuesFrag = ctx.warpCache(cg`[${
          cg.join(node.values.map((value) => JSON.stringify(rewriteEnumValue(value, node))), ',')
      }]`);
      return cg`${RUNTIME_VAR}.e(${ctx.valueVar},${valuesFrag},${ctx.ctxVar},${ctx.pointerVar});`;
    },

    elements(node, ctx, next) {
      if (isUnconstrainedNode(node.elementNode)) {
        return cg`${RUNTIME_VAR}.a(${ctx.valueVar},${ctx.ctxVar},${ctx.pointerVar});`;
      }

      const indexVar = cg.var();
      const valueVar = cg.var();
      const pointerVar = cg.var();

      return cg.block`if(${RUNTIME_VAR}.a(${ctx.valueVar},${ctx.ctxVar},${ctx.pointerVar})){${
          cg.block`for(${indexVar}=0;${indexVar}<${ctx.valueVar}.length;${indexVar}++){${cg(
              cg.let(valueVar, cg`${ctx.valueVar}[${indexVar}]`),
              cg.let(pointerVar, cg`${ctx.pointerVar}+${indexVar}`),

              next({...ctx, pointerVar, valueVar}),
          )}}`
      }}`;
    },

    values(node, ctx, next) {
      if (isUnconstrainedNode(node.valueNode)) {
        return cg`${RUNTIME_VAR}.o(${ctx.valueVar},${ctx.ctxVar},${ctx.pointerVar});`;
      }

      const keyVar = cg.var();
      const valueVar = cg.var();
      const pointerVar = cg.var();

      return cg.block`if(${RUNTIME_VAR}.o(${ctx.valueVar},${ctx.ctxVar},${ctx.pointerVar})){${
          cg.block`for(${keyVar} in ${ctx.valueVar}){${cg(
              cg.let(valueVar, cg`${ctx.valueVar}[${keyVar}]`),
              cg.let(pointerVar, cg`${ctx.pointerVar}+${RUNTIME_VAR}.p(${keyVar})`),

              next({...ctx, valueVar, pointerVar}),
          )}}`
      }}`;
    },

    object(node, ctx, next) {
      if (Object.values(node.properties).every(isUnconstrainedNode) && Object.values(node.optionalProperties).every(isUnconstrainedNode)) {
        return cg`${RUNTIME_VAR}.o(${ctx.valueVar},${ctx.ctxVar},${ctx.pointerVar})`;
      }

      return cg.block`if(${RUNTIME_VAR}.o(${ctx.valueVar},${ctx.ctxVar},${ctx.pointerVar})){${
          next(ctx)
      }}`;
    },

    property(propKey, propNode, objectNode, ctx, next) {
      if (isUnconstrainedNode(propNode)) {
        return cg``;
      }

      const valueVar = cg.var();
      const pointerVar = cg.var();

      propKey = renamePropertyKey(propKey, propNode, objectNode);

      return cg.block(
          cg.let(valueVar, cg`${ctx.valueVar}${compilePropertyAccessor(propKey)}`),
          cg.let(pointerVar, cg`${ctx.pointerVar}+${compileJsonPointer(propKey)}`),

          next({...ctx, valueVar, pointerVar}),
      );
    },

    optionalProperty(propKey, propNode, objectNode, ctx, next) {
      if (isUnconstrainedNode(propNode)) {
        return cg``;
      }

      const valueVar = cg.var();
      const pointerVar = cg.var();

      propKey = renamePropertyKey(propKey, propNode, objectNode);

      return cg.block(
          cg.let(valueVar, cg`${ctx.valueVar}${compilePropertyAccessor(propKey)}`),

          cg.block`if(${valueVar}!==undefined){${cg(
              cg.let(pointerVar, cg`${ctx.pointerVar}+${compileJsonPointer(propKey)}`),

              next({...ctx, valueVar, pointerVar}),
          )}}`,
      );
    },

    union(node, ctx, next) {
      const discriminatorKey = renameDiscriminatorKey(node);

      return cg.block`if(${RUNTIME_VAR}.o(${ctx.valueVar},${ctx.ctxVar},${ctx.pointerVar})){${cg(
          cg`switch(${ctx.valueVar}${compilePropertyAccessor(discriminatorKey)}){${cg(
              next(ctx),

              cg`default:${RUNTIME_VAR}.r(${ctx.ctxVar},${ctx.pointerVar}+${compileJsonPointer(discriminatorKey)})`,
          )}}`,
      )}}`;
    },

    mapping(mappingKey, mappingNode, unionNode, ctx, next) {
      return cg.block(
          cg`case ${JSON.stringify(rewriteMappingKey(mappingKey, mappingNode, undefined, unionNode))}:`,
          next(ctx),
          'break;',
      );
    },
  };
}

function compileJsonPointer(key: string): string {
  return JSON.stringify('/' + escapeJsonPointer(key));
}

function isUnconstrainedNode<M>(node: JtdNode<M>): boolean {
  return node.nodeType === JtdNodeType.ANY || node.nodeType === JtdNodeType.NULLABLE && isUnconstrainedNode(node.valueNode);
}

const jtdTypeCheckerMap: Record<string, keyof typeof runtime> = {
  [JtdType.BOOLEAN]: 'b',
  [JtdType.STRING]: 's',
  [JtdType.TIMESTAMP]: 's',
  [JtdType.FLOAT32]: 'n',
  [JtdType.FLOAT64]: 'n',
  [JtdType.INT8]: 'i',
  [JtdType.UINT8]: 'i',
  [JtdType.INT16]: 'i',
  [JtdType.UINT16]: 'i',
  [JtdType.INT32]: 'i',
  [JtdType.UINT32]: 'i',
};

/**
 * Global default options used by {@link createJtdDialect}.
 */
export const jtdDialectOptions: Required<IJtdcDialectOptions<any>> = {
  renameValidator: (ref) => 'validate' + pascalCase(ref),
  renamePropertyKey: (propKey) => propKey,
  renameDiscriminatorKey: (node) => node.discriminator,
  rewriteEnumValue: (value) => value,
  rewriteMappingKey: (mappingKey) => mappingKey,
  renameTypeGuard: (ref) => 'is' + pascalCase(ref),
  renameType: (ref) => pascalCase(ref),
};
