import {IJtdcDialect, JtdNode} from '@jtdc/types';
import {visitJtdNode} from './jtd-visitor';
import {compileJsSource, IFragmentCgNode, template as _} from '@smikhalevski/codegen';

export interface IValidatorCompilerOptions<M, C> {

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
 * @template M The type of the metadata.
 * @template C The type of the context.
 */
export function compileValidators<M, C>(definitions: Record<string, JtdNode<M>>, dialect: IJtdcDialect<M, C>, options: IValidatorCompilerOptions<M, C> = {}): string {
  const {typeGuardsRendered} = options;

  let src = '';

  for (const [ref, node] of Object.entries(definitions)) {
    src += compileJsSource(dialect.validator(ref, node, (ctx) => compileValidatorBody(node, ctx, dialect)));

    if (typeGuardsRendered) {
      src += compileJsSource(dialect.typeGuard(ref, node));
    }
  }
  return src;
}

function compileValidatorBody<M, C>(node: JtdNode<M>, ctx: C, dialect: IJtdcDialect<M, C>): IFragmentCgNode {
  let frags: Array<IFragmentCgNode> = [];

  const createNext = (next: () => void) => (nextCtx: C) => {
    const prevFrags = frags;
    const prevCtx = ctx;

    frags = [];
    ctx = nextCtx;
    next();

    const nextFrag = _(frags);

    frags = prevFrags;
    ctx = prevCtx;

    return nextFrag;
  };

  visitJtdNode(node, {
    ref(node) {
      frags.push(dialect.ref(node, ctx));
    },
    nullable(node, next) {
      frags.push(dialect.nullable(node, ctx, createNext(next)));
    },
    type(node) {
      frags.push(dialect.type(node, ctx));
    },
    enum(node) {
      frags.push(dialect.enum(node, ctx));
    },
    elements(node, next) {
      frags.push(dialect.elements(node, ctx, createNext(next)));
    },
    values(node, next) {
      frags.push(dialect.values(node, ctx, createNext(next)));
    },
    object(node, next) {
      frags.push(dialect.object(node, ctx, createNext(next)));
    },
    property(propKey, propNode, objectNode, next) {
      frags.push(dialect.property(propKey, propNode, objectNode, ctx, createNext(next)));
    },
    optionalProperty(propKey, propNode, objectNode, next) {
      frags.push(dialect.optionalProperty(propKey, propNode, objectNode, ctx, createNext(next)));
    },
    union(node, next) {
      frags.push(dialect.union(node, ctx, createNext(next)));
    },
    mapping(mappingKey, mappingNode, unionNode, next) {
      frags.push(dialect.mapping(mappingKey, mappingNode, unionNode, ctx, createNext(next)));
    },
  });

  return _(frags);
}
