import {
  collectVarRefs,
  compilePropertyAccessor,
  encodeLetters,
  IFragmentCgNode,
  inlineVarAssignments,
  IVarRefCgNode,
  joinFragmentChildren,
  template as _,
} from '@smikhalevski/codegen';
import {JtdNode, JtdNodeType, JtdType, ValidatorDialectFactory} from '@jtdc/types';
import * as runtime from './runtime';
import {toJsonPointer} from './json-pointer';

/**
 * Context used by the dialect during validator compilation.
 */
export interface IJtdValidatorDialectContext {
  valueVar: IVarRefCgNode;
  ctxVar: IVarRefCgNode;
  pointerVar: IVarRefCgNode;

  /**
   * Wraps an expression so result is retained between validator invocations.
   */
  warpCache(fragment: IFragmentCgNode): IFragmentCgNode;
}

/**
 * Creates a validator compilation dialect that renders validators which follow the JTD specification.
 *
 * @template M The type of the JTD metadata.
 */
export const validatorDialectFactory: ValidatorDialectFactory<unknown, IJtdValidatorDialectContext> = (config) => {

  const {
    runtimeVarName,
    renameValidator,
    renamePropertyKey,
    renameDiscriminatorKey,
    rewriteEnumValue,
    rewriteMappingKey,
    renameTypeGuard,
    renameType,
  } = config;

  return {

    import() {
      return _`import*as ${runtimeVarName} from"@jtdc/jtd-dialect/lib/runtime";`;
    },

    typeGuard(jtdName, node) {
      const name = renameTypeGuard(jtdName, node);

      return _`export let ${name}=(value:unknown):value is ${renameType(jtdName, node)}=>!${renameValidator(jtdName, node)}(value,{shallow:true});`;
    },

    validator(jtdName, node, next) {
      const valueVar = _.var();
      const ctxVar = _.var();
      const pointerVar = _.var();
      const cacheVar = _.var();
      const name = renameValidator(jtdName, node);

      let cacheSize = 0;

      const bodyFragment = _(
          _.assignment(ctxVar, _`${ctxVar}||{}`, true),
          _.assignment(pointerVar, _`${pointerVar}||""`),
          _.assignment(cacheVar, _`(${name}.cache||={})`),
          next({
            valueVar,
            ctxVar,
            pointerVar,
            warpCache: (fragment) => _`${cacheVar}.${encodeLetters(cacheSize++)}||=${fragment}`,
          }),
          _`return ${ctxVar}.errors;`,
      );

      inlineVarAssignments(bodyFragment);

      const undeclaredVars = collectVarRefs(bodyFragment, [valueVar, ctxVar, pointerVar]);

      return _.block`export let ${name}:${runtimeVarName}.Validator=(${valueVar},${ctxVar},${pointerVar})=>{${_(
          undeclaredVars.length !== 0 && _`let ${joinFragmentChildren(undeclaredVars, ',')};`,
          bodyFragment,
      )}};`;
    },

    ref(node, ctx) {
      return _`${renameValidator(node.ref, node)}(${ctx.valueVar},${ctx.ctxVar},${ctx.pointerVar});`;
    },

    nullable(node, ctx, next) {
      if (isUnconstrainedNode(node.valueNode)) {
        return _``;
      }
      return _.block`if(${runtimeVarName}.isNotNull(${ctx.valueVar})){${
          next(ctx)
      }}`;
    },

    type(node, ctx) {
      const typeCheckerName = jtdTypeCheckerMap[node.type as JtdType];

      if (!typeCheckerName) {
        throw new Error('Unknown type: ' + node.type);
      }
      return _`${runtimeVarName}.${typeCheckerName}(${ctx.valueVar},${ctx.ctxVar},${ctx.pointerVar});`;
    },

    enum(node, ctx) {
      const valuesFragment = ctx.warpCache(_`[${
          joinFragmentChildren(node.values.map((value) => JSON.stringify(rewriteEnumValue(value, node))), ',')
      }]`);
      return _`${runtimeVarName}.checkEnum(${ctx.valueVar},${valuesFragment},${ctx.ctxVar},${ctx.pointerVar});`;
    },

    elements(node, ctx, next) {
      if (isUnconstrainedNode(node.elementNode)) {
        return _`${runtimeVarName}.checkArray(${ctx.valueVar},${ctx.ctxVar},${ctx.pointerVar});`;
      }

      const indexVar = _.var();
      const valueVar = _.var();
      const pointerVar = _.var();

      return _.block`if(${runtimeVarName}.checkArray(${ctx.valueVar},${ctx.ctxVar},${ctx.pointerVar})){${
          _.block`for(${indexVar}=0;${indexVar}<${ctx.valueVar}.length;${indexVar}++){${_(
              _.assignment(valueVar, _`${ctx.valueVar}[${indexVar}]`),
              _.assignment(pointerVar, _`${ctx.pointerVar}+${runtimeVarName}.JSON_POINTER_SEPARATOR+${indexVar}`),

              next({...ctx, pointerVar, valueVar}),
          )}}`
      }}`;
    },

    values(node, ctx, next) {
      if (isUnconstrainedNode(node.valueNode)) {
        return _`${runtimeVarName}.checkObject(${ctx.valueVar},${ctx.ctxVar},${ctx.pointerVar});`;
      }

      const indexVar = _.var();
      const keysVar = _.var();
      const valueVar = _.var();
      const pointerVar = _.var();

      return _.block`if(${runtimeVarName}.checkObject(${ctx.valueVar},${ctx.ctxVar},${ctx.pointerVar})){${
          _.block`for(${indexVar}=0,${keysVar}=${runtimeVarName}.getObjectKeys(${ctx.valueVar});${indexVar}<${keysVar}.length;${indexVar}++){${_(
              _.assignment(valueVar, _`${ctx.valueVar}[${keysVar}[${indexVar}]]`),
              _.assignment(pointerVar, _`${ctx.pointerVar}+${runtimeVarName}.toJsonPointer(${keysVar}[${indexVar}])`),

              next({...ctx, valueVar, pointerVar}),
          )}}`
      }}`;
    },

    object(node, ctx, next) {
      if (Object.values(node.properties).every(isUnconstrainedNode) && Object.values(node.optionalProperties).every(isUnconstrainedNode)) {
        return _`${runtimeVarName}.checkObject(${ctx.valueVar},${ctx.ctxVar},${ctx.pointerVar})`;
      }

      return _.block`if(${runtimeVarName}.checkObject(${ctx.valueVar},${ctx.ctxVar},${ctx.pointerVar})){${
          next(ctx)
      }}`;
    },

    property(propKey, propNode, objectNode, ctx, next) {
      if (isUnconstrainedNode(propNode)) {
        return _``;
      }

      propKey = renamePropertyKey(propKey, propNode, objectNode);

      const valueVar = _.var();
      const pointerVar = _.var();

      return _.block(
          _.assignment(valueVar, _`${ctx.valueVar}${compilePropertyAccessor(propKey)}`),
          _.assignment(pointerVar, _`${ctx.pointerVar}+${compileJsonPointer(propKey)}`),
          next({...ctx, valueVar, pointerVar}),
      );
    },

    optionalProperty(propKey, propNode, objectNode, ctx, next) {
      if (isUnconstrainedNode(propNode)) {
        return _``;
      }

      propKey = renamePropertyKey(propKey, propNode, objectNode);

      const valueVar = _.var();
      const pointerVar = _.var();

      return _.block(
          _.assignment(valueVar, _`${ctx.valueVar}${compilePropertyAccessor(propKey)}`),
          _.block`if(${runtimeVarName}.isDefined(${valueVar})){${_(
              _.assignment(pointerVar, _`${ctx.pointerVar}+${compileJsonPointer(propKey)}`),
              next({...ctx, valueVar, pointerVar}),
          )}}`,
      );
    },

    union(node, ctx, next) {
      const discriminatorKey = renameDiscriminatorKey(node);

      return _.block`if(${runtimeVarName}.checkObject(${ctx.valueVar},${ctx.ctxVar},${ctx.pointerVar})){${_(
          _`switch(${ctx.valueVar}${compilePropertyAccessor(discriminatorKey)}){${_(
              next(ctx),
          )}}${runtimeVarName}.raiseInvalid(${ctx.ctxVar},${ctx.pointerVar}+${compileJsonPointer(discriminatorKey)})`,
      )}}`;
    },

    mapping(mappingKey, mappingNode, unionNode, ctx, next) {
      return _.block(
          _`case ${JSON.stringify(rewriteMappingKey(mappingKey, mappingNode, undefined, unionNode))}:`,
          next(ctx),
          'break;',
      );
    },
  };
};

export function compileJsonPointer(key: string): string {
  return JSON.stringify(toJsonPointer(key));
}

export function isUnconstrainedNode<M>(node: JtdNode<M>): boolean {
  return node.nodeType === JtdNodeType.ANY || node.nodeType === JtdNodeType.NULLABLE && isUnconstrainedNode(node.valueNode);
}

const jtdTypeCheckerMap: Record<JtdType, keyof typeof runtime> = {
  [JtdType.BOOLEAN]: 'checkBoolean',
  [JtdType.STRING]: 'checkString',
  [JtdType.TIMESTAMP]: 'checkTimestamp',
  [JtdType.FLOAT32]: 'checkNumber',
  [JtdType.FLOAT64]: 'checkNumber',
  [JtdType.INT8]: 'checkInteger',
  [JtdType.UINT8]: 'checkInteger',
  [JtdType.INT16]: 'checkInteger',
  [JtdType.UINT16]: 'checkInteger',
  [JtdType.INT32]: 'checkInteger',
  [JtdType.UINT32]: 'checkInteger',
};
