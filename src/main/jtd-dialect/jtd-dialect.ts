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
import {toJsonPointer} from './runtime';
import {IJtdcDialect, IJtdcDialectOptions} from '../dialect-types';

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
      return cg`import{_S,_P,_K,_R,_o,_a,_e,_b,_s,_n,_i,_N,_O,Validator as _Validator}from"jtdc/lib/jtd-dialect/runtime";`;
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
          cg.block`const ${name}:_Validator=(${valueVar},${ctxVar},${pointerVar})=>{${cg(
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
      return cg.block`if(_N(${ctx.valueVar})){${
          next(ctx)
      }}`;
    },

    type(node, ctx) {
      const typeCheckerName = jtdTypeCheckerMap[node.type] || die('Unknown type: ' + node.type);
      return cg`${typeCheckerName}(${ctx.valueVar},${ctx.ctxVar},${ctx.pointerVar});`;
    },

    enum(node, ctx) {
      const valuesFrag = ctx.warpCache(cg`[${
          cg.join(node.values.map((value) => JSON.stringify(rewriteEnumValue(value, node))), ',')
      }]`);
      return cg`_e(${ctx.valueVar},${valuesFrag},${ctx.ctxVar},${ctx.pointerVar});`;
    },

    elements(node, ctx, next) {
      if (isUnconstrainedNode(node.elementNode)) {
        return cg`_a(${ctx.valueVar},${ctx.ctxVar},${ctx.pointerVar});`;
      }

      const indexVar = cg.var();
      const valueVar = cg.var();
      const pointerVar = cg.var();

      return cg.block`if(_a(${ctx.valueVar},${ctx.ctxVar},${ctx.pointerVar})){${
          cg.block`for(${indexVar}=0;${indexVar}<${ctx.valueVar}.length;${indexVar}++){${cg(
              cg.let(valueVar, cg`${ctx.valueVar}[${indexVar}]`),
              cg.let(pointerVar, cg`${ctx.pointerVar}+_S+${indexVar}`),

              next({...ctx, pointerVar, valueVar}),
          )}}`
      }}`;
    },

    values(node, ctx, next) {
      if (isUnconstrainedNode(node.valueNode)) {
        return cg`_o(${ctx.valueVar},${ctx.ctxVar},${ctx.pointerVar});`;
      }

      const indexVar = cg.var();
      const keysVar = cg.var();
      const valueVar = cg.var();
      const pointerVar = cg.var();

      return cg.block`if(_o(${ctx.valueVar},${ctx.ctxVar},${ctx.pointerVar})){${
          cg.block`for(${indexVar}=0,${keysVar}=_K(${ctx.valueVar});${indexVar}<${keysVar}.length;${indexVar}++){${cg(
              cg.let(valueVar, cg`${ctx.valueVar}[${keysVar}[${indexVar}]]`),
              cg.let(pointerVar, cg`${ctx.pointerVar}+_P(${keysVar}[${indexVar}])`),

              next({...ctx, valueVar, pointerVar}),
          )}}`
      }}`;
    },

    object(node, ctx, next) {
      if (Object.values(node.properties).every(isUnconstrainedNode) && Object.values(node.optionalProperties).every(isUnconstrainedNode)) {
        return cg`_o(${ctx.valueVar},${ctx.ctxVar},${ctx.pointerVar})`;
      }

      return cg.block`if(_o(${ctx.valueVar},${ctx.ctxVar},${ctx.pointerVar})){${
          next(ctx)
      }}`;
    },

    property(propKey, propNode, objectNode, ctx, next) {
      if (isUnconstrainedNode(propNode)) {
        return cg``;
      }

      propKey = renamePropertyKey(propKey, propNode, objectNode);

      const valueVar = cg.var();
      const pointerVar = cg.var();

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

      propKey = renamePropertyKey(propKey, propNode, objectNode);

      const valueVar = cg.var();
      const pointerVar = cg.var();

      return cg.block(
          cg.let(valueVar, cg`${ctx.valueVar}${compilePropertyAccessor(propKey)}`),
          cg.block`if(_O(${valueVar})){${cg(
              cg.let(pointerVar, cg`${ctx.pointerVar}+${compileJsonPointer(propKey)}`),
              next({...ctx, valueVar, pointerVar}),
          )}}`,
      );
    },

    union(node, ctx, next) {
      const discriminatorKey = renameDiscriminatorKey(node);

      return cg.block`if(_o(${ctx.valueVar},${ctx.ctxVar},${ctx.pointerVar})){${cg(
          cg`switch(${ctx.valueVar}${compilePropertyAccessor(discriminatorKey)}){${cg(
              next(ctx),
          )}}_R(${ctx.ctxVar},${ctx.pointerVar}+${compileJsonPointer(discriminatorKey)})`,
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
  return JSON.stringify(toJsonPointer(key));
}

function isUnconstrainedNode<M>(node: JtdNode<M>): boolean {
  return node.nodeType === JtdNodeType.ANY || node.nodeType === JtdNodeType.NULLABLE && isUnconstrainedNode(node.valueNode);
}

const jtdTypeCheckerMap: Record<string, keyof typeof runtime> = {
  [JtdType.BOOLEAN]: '_b',
  [JtdType.STRING]: '_s',
  [JtdType.TIMESTAMP]: '_s',
  [JtdType.FLOAT32]: '_n',
  [JtdType.FLOAT64]: '_n',
  [JtdType.INT8]: '_i',
  [JtdType.UINT8]: '_i',
  [JtdType.INT16]: '_i',
  [JtdType.UINT16]: '_i',
  [JtdType.INT32]: '_i',
  [JtdType.UINT32]: '_i',
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
