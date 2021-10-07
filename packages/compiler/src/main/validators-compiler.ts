import {IValidatorDialect, IValidatorDialectConfig, IJtdNodeDict, JtdNode} from '@jtdc/types';
import {visitJtdNode} from './jtd-visitor';
import {compileJsSource, IFragmentCgNode, template as _} from '@smikhalevski/codegen';
import {pascalCase} from 'change-case-all';

export interface IValidatorsCompilerOptions<M, C> {

  /**
   * If set to `true` then type guards are rendered along with validators.
   *
   * @see {@link https://www.typescriptlang.org/docs/handbook/2/narrowing.html TypeScript Narrowing}
   */
  typeGuardsRendered?: boolean;
}

/**
 * Compiles validators and type guards from the definitions.
 *
 * @param definitions Definitions for which validators must be compiled.
 * @param dialect The validator compilation dialect that describes how validators and type guards are compiled.
 * @param options Compilation options.
 *
 * @template M The type of the JTD metadata.
 * @template C The type of the context.
 */
export function compileValidators<M, C>(definitions: IJtdNodeDict<M>, dialect: IValidatorDialect<M, C>, options: IValidatorsCompilerOptions<M, C> = {}): string {
  const {typeGuardsRendered} = options;

  let src = '';

  for (const [name, node] of Object.entries(definitions)) {
    src += compileJsSource(dialect.validator(name, node, (ctx) => compileValidatorBody(node, ctx, dialect)));

    if (typeGuardsRendered) {
      src += compileJsSource(dialect.typeGuard(name, node));
    }
  }
  return src;
}

function compileValidatorBody<M, C>(node: JtdNode<M>, ctx: C, dialect: IValidatorDialect<M, C>): IFragmentCgNode {
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
      fragments.push(dialect.ref(node, ctx));
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
}

/**
 * The default validator dialect config.
 */
export const validatorDialectConfig: IValidatorDialectConfig<any> = {
  runtimeVarName: 'runtime',
  renameValidator: (name) => 'validate' + pascalCase(name),
  renamePropertyKey: (propKey) => propKey,
  renameDiscriminatorKey: (node) => node.discriminator,
  rewriteEnumValue: (value) => value,
  rewriteMappingKey: (mappingKey) => mappingKey,
  renameTypeGuard: (name) => 'is' + pascalCase(name),
  renameType: (name) => pascalCase(name),
};
