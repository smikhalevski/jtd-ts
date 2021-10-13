import {IValidatorDialect, IValidatorDialectConfig, JtdNode, RefResolver} from '@jtdc/types';
import {visitJtdNode} from './visitJtdNode';
import {compileJsSource, IFragmentCgNode, template as _} from '@smikhalevski/codegen';
import {pascalCase} from 'change-case-all';

/**
 * Compiles a validator function.
 *
 * @param name The JTD definition name.
 * @param node The JTD node to compile.
 * @param refResolver Returns a name of the validator function referenced by node.
 * @param dialect The validator compilation dialect that describes how validators and type guards are compiled.
 *
 * @template M The type of the JTD metadata.
 * @template C The type of the context.
 */
export function compileValidatorFunction<M, C>(name: string, node: JtdNode<M>, refResolver: RefResolver<M>, dialect: IValidatorDialect<M, C>): string {
  return compileJsSource(dialect.validator(name, node, (ctx) => {

    let fragments: Array<IFragmentCgNode> = [];

    const createNext = (next: () => void) => (nextCtx: C) => {
      const prevFragments = fragments;
      const prevCtx = ctx;

      fragments = [];
      ctx = nextCtx;
      next();

      const nextFragment = _(fragments);

      fragments = prevFragments;
      ctx = prevCtx;

      return nextFragment;
    };

    visitJtdNode(node, {
      ref(node) {
        fragments.push(dialect.ref(node, refResolver, ctx));
      },
      nullable(node, next) {
        fragments.push(dialect.nullable(node, ctx, createNext(next)));
      },
      type(node) {
        fragments.push(dialect.type(node, ctx));
      },
      enum(node) {
        fragments.push(dialect.enum(node, ctx));
      },
      elements(node, next) {
        fragments.push(dialect.elements(node, ctx, createNext(next)));
      },
      values(node, next) {
        fragments.push(dialect.values(node, ctx, createNext(next)));
      },
      object(node, next) {
        fragments.push(dialect.object(node, ctx, createNext(next)));
      },
      property(propKey, propNode, objectNode, next) {
        fragments.push(dialect.property(propKey, propNode, objectNode, ctx, createNext(next)));
      },
      optionalProperty(propKey, propNode, objectNode, next) {
        fragments.push(dialect.optionalProperty(propKey, propNode, objectNode, ctx, createNext(next)));
      },
      union(node, next) {
        fragments.push(dialect.union(node, ctx, createNext(next)));
      },
      mapping(mappingKey, mappingNode, unionNode, next) {
        fragments.push(dialect.mapping(mappingKey, mappingNode, unionNode, ctx, createNext(next)));
      },
    });

    return _(fragments);
  }));
}

export const validatorDialectConfig: IValidatorDialectConfig<any> = {
  runtimeVarName: 'runtime',
  renameValidatorFunction: (name) => 'validate' + pascalCase(name),
  renamePropertyKey: (propKey) => propKey,
  renameDiscriminatorKey: (node) => node.discriminator,
  rewriteEnumValue: (value) => value,
  rewriteMappingKey: (mappingKey) => mappingKey,
};
