import {cg, IVarRefCgNode, pascalCase} from '@smikhalevski/codegen';
import {IJtdEnumNode, IJtdObjectNode, IJtdUnionNode, JtdNode, JtdNodeType} from '../jtd-ast-types';
import {JtdType} from '../jtd-types';
import {die} from '../misc';
import * as runtime from './runtime';
import {IJtdcDialect} from '../dialect-types';

export interface IJtdDialectOptions<M> {

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
   * Returns the name of the type narrowing function. This is used if {@link emitsTypeNarrowing} is enabled.
   */
  renameTypeNarrowing?: (ref: string, node: JtdNode<M>) => string;

  /**
   * Returns a TypeScript type name described by `node`.
   *
   * @param ref The ref of the renamed type.
   * @param node The node that describes the renamed type.
   *
   * @default pascalCase
   */
  renameTypeDeclaration?: (ref: string, node: JtdNode<M>) => string;
}

export interface IJtdDialectContext {
  valueVar: IVarRefCgNode;
  pointerVar: IVarRefCgNode;
  contextVar: IVarRefCgNode;
}

export default function createJtdDialect<M>(options?: IJtdDialectOptions<M>): IJtdcDialect<M, IJtdDialectContext> {
  const opt = Object.assign({}, jtdDialectCompilerOptions, options);

  const {
    renameValidator,
    renamePropertyKey,
    renameDiscriminatorKey,
    rewriteEnumValue,
    rewriteMappingKey,
    renameTypeNarrowing,
    renameTypeDeclaration,
  } = opt;

  return {

    import() {
      return cg`import * as r from "jtdc/lib/jtd-dialect/runtime";`;
    },

    typeNarrowing(ref, node) {
      const name = renameTypeNarrowing(ref, node);
      return cg(
          cg`const ${name}=(value:unknown):value is ${ref}=>!${renameValidator(ref, node)}(value,{lazy:true});`,
          cg`export{${name}};`,
      );
    },

    validator(ref, node, next) {
      const valueVar = cg.var();
      const pointerVar = cg.var();
      const contextVar = cg.var();

      const validatorBody = cg.block(
          cg.let(contextVar, cg`${contextVar}||{}`),
          cg.let(pointerVar, cg`${pointerVar}||""`),
          next({
            valueVar,
            pointerVar,
            contextVar,
          }),
      );

      // const varRefs = collectVarRefs(validatorBody);
      //
      // varRefs.delete(valueVar);
      // varRefs.delete(pointerVar);
      // varRefs.delete(contextVar);

      const name = renameValidator(ref, node);

      return cg(
          cg.block`const ${name}:Validator=(${valueVar},${contextVar},${pointerVar})=>{${cg(
              // varRefs.size != 0 && (
              //     cg`let ${cg.join(varRefs, ',')};`
              // ),
              validatorBody,
              cg`return ${contextVar}.errors;`,
          )}};`,
          cg`export{${name}};`,
      );
    },

    ref(node, ctx) {
      return cg`${renameValidator(node.ref, node)}(${ctx.valueVar},${ctx.contextVar},${ctx.pointerVar});`;
    },

    nullable(node, ctx, next) {
      if (isUnconstrainedNode(node.valueNode)) {
        return cg``;
      }
      return cg.block`if(${ctx.valueVar}!==null){${next(ctx)}}`;
    },

    type(node, ctx) {
      const typeCheckerName = jtdTypeCheckerMap[node.type] || die('Unknown type: ' + node.type);
      return cg`r.${typeCheckerName}(${ctx.valueVar},${ctx.contextVar},${ctx.pointerVar});`;
    },

    enum(node, ctx) {
      return cg`r.e(${ctx.valueVar},[/*values*/],${ctx.contextVar},${ctx.pointerVar});`;
    },

    elements(node, ctx, next) {
      if (isUnconstrainedNode(node.elementNode)) {
        return cg`r.a(${ctx.valueVar},${ctx.contextVar},${ctx.pointerVar});`;
      }

      const indexVar = cg.var();
      const valueVar = cg.var();
      const pointerVar = cg.var();

      return cg.block`if(r.a(${ctx.valueVar},${ctx.contextVar},${ctx.pointerVar})){${cg(
          cg.block`for(${indexVar}=0;${indexVar}<${ctx.valueVar}.length;${indexVar}++){${cg(
              cg.let(valueVar, cg`${ctx.valueVar}[${indexVar}]`),
              cg.let(pointerVar, cg`${ctx.pointerVar}+${indexVar}`),
              next({
                valueVar,
                pointerVar,
                contextVar: ctx.contextVar,
              }),
          )}}`,
      )}}`;
    },

    values(node, ctx, next) {
      if (isUnconstrainedNode(node.valueNode)) {
        return cg`r.o(${ctx.valueVar},${ctx.contextVar},${ctx.pointerVar});`;
      }

      const keyVar = cg.var();
      const valueVar = cg.var();
      const pointerVar = cg.var();

      return cg.block`if(r.o(${ctx.valueVar},${ctx.contextVar},${ctx.pointerVar})){${cg(
          cg.block`for(${keyVar} in ${ctx.valueVar}){${cg(
              cg.let(valueVar, cg`${ctx.valueVar}[${keyVar}]`),
              cg.let(pointerVar, cg`${ctx.pointerVar}+r.p(${keyVar})`),
              next({
                valueVar,
                pointerVar,
                contextVar: ctx.contextVar,
              }),
          )}}`,
      )}}`;
    },

    object(node, ctx, next) {
      if (Object.values(node.properties).every(isUnconstrainedNode) && Object.values(node.optionalProperties).every(isUnconstrainedNode)) {
        return cg`r.o(${ctx.valueVar},${ctx.contextVar},${ctx.pointerVar})`;
      }

      return cg.block`if(r.o(${ctx.valueVar},${ctx.contextVar},${ctx.pointerVar})){${next(ctx)}}`;
    },

    property(propKey, propNode, objectNode, ctx, next) {
      if (isUnconstrainedNode(propNode)) {
        return cg``;
      }

      const valueVar = cg.var();
      const pointerVar = cg.var();

      return cg(
          cg.let(valueVar, cg`${ctx.valueVar}.${propKey}`),
          cg.let(pointerVar, cg`${ctx.pointerVar}+${JSON.stringify('/' + propKey)}`),
          next({
            valueVar,
            pointerVar,
            contextVar: ctx.contextVar,
          }),
      );
    },

    optionalProperty(propKey, propNode, objectNode, ctx, next) {
      if (isUnconstrainedNode(propNode)) {
        return cg``;
      }

      const valueVar = cg.var();
      const pointerVar = cg.var();

      return cg.block(
          cg.let(valueVar, cg`${ctx.valueVar}.${propKey}`),
          cg.block`if(${valueVar}!==undefined){${cg(
              cg.let(pointerVar, cg`${ctx.pointerVar}+${JSON.stringify('/' + propKey)}`),
              next({
                valueVar,
                pointerVar,
                contextVar: ctx.contextVar,
              }),
          )}}`,
      );
    },

    union(node, ctx, next) {
      return cg.block`if(r.o(${ctx.valueVar},${ctx.contextVar},${ctx.pointerVar})){${cg(
          cg`switch(${ctx.valueVar}.${node.discriminator}){${cg(
              next(ctx),
              cg`default:r.r(${ctx.contextVar},${ctx.pointerVar}+${JSON.stringify('/' + node.discriminator)})`,
          )}}`,
      )}}`;
    },

    mapping(mappingKey, mappingNode, unionNode, ctx, next) {
      return cg.block`case ${JSON.stringify(mappingKey)}:${next(ctx)};break;`;
    },
  };
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

export const jtdDialectCompilerOptions: Required<IJtdDialectOptions<any>> = {
  renameValidator: (ref) => 'validate' + pascalCase(ref),
  renamePropertyKey: (propKey) => propKey,
  renameDiscriminatorKey: (node) => node.discriminator,
  rewriteEnumValue: (value) => value,
  rewriteMappingKey: (mappingKey) => mappingKey,
  renameTypeNarrowing: (ref) => 'is' + pascalCase(ref),
  renameTypeDeclaration: (ref) => pascalCase(ref),
};
