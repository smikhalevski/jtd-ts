import {JtdNode} from './jtd-ast-types';
import {IJtdcDialect} from './dialect-types';
import {visitJtdNode} from './jtd-visitor';
import {cg, compileTsSource, IFragmentCgNode} from '@smikhalevski/codegen';
import createJtdDialect from './jtd-dialect';

export interface IValidatorCompilerOptions<M, C> {

  /**
   * If set to `true` then type narrowing functions are emitted along with validators.
   *
   * @see {@link https://www.typescriptlang.org/docs/handbook/2/narrowing.html TypeScript Narrowing}
   */
  typeNarrowingEnabled?: boolean;

  /**
   * The validator compilation dialect that describes how validators and type narrowing functions are generated.
   */
  dialect?: IJtdcDialect<M, C>;
}

export function compileValidators<M, C>(definitions: Record<string, JtdNode<M>>, options?: IValidatorCompilerOptions<M, C>): string {
  const opt = Object.assign({}, validatorCompilerOptions, options);

  const {
    typeNarrowingEnabled,
    dialect,
  } = opt;

  let src = compileTsSource(dialect.import());

  for (const [ref, node] of Object.entries(definitions)) {
    src += compileTsSource(dialect.validator(ref, node, (ctx) => compileValidator(node, ctx, dialect)));

    if (typeNarrowingEnabled) {
      src += compileTsSource(dialect.typeNarrowing(ref, node));
    }
  }
  return src;
}

function compileValidator<M, C>(node: JtdNode<M>, ctx: C, dialect: IJtdcDialect<M, C>): IFragmentCgNode {
  let frag = cg``;

  const createNext = (next: () => void) => (nextCtx: C) => {
    const prevCtx = ctx;
    ctx = nextCtx;
    next();
    ctx = prevCtx;
    return frag;
  };

  visitJtdNode(node, {
    ref(node) {
      frag = dialect.ref(node, ctx);
    },
    nullable(node, next) {
      frag = dialect.nullable(node, ctx, createNext(next));
    },
    type(node) {
      frag = dialect.type(node, ctx);
    },
    enum(node) {
      frag = dialect.enum(node, ctx);
    },
    elements(node, next) {
      frag = dialect.elements(node, ctx, createNext(next));
    },
    values(node, next) {
      frag = dialect.values(node, ctx, createNext(next));
    },
    object(node, next) {
      frag = dialect.object(node, ctx, createNext(next));
    },
    property(propKey, propNode, objectNode, next) {
      frag = dialect.property(propKey, propNode, objectNode, ctx, createNext(next));
    },
    optionalProperty(propKey, propNode, objectNode, next) {
      frag = dialect.optionalProperty(propKey, propNode, objectNode, ctx, createNext(next));
    },
    union(node, next) {
      frag = dialect.union(node, ctx, createNext(next));
    },
    mapping(mappingKey, mappingNode, unionNode, next) {
      frag = dialect.mapping(mappingKey, mappingNode, unionNode, ctx, createNext(next));
    },
  });

  return frag;
}

export const validatorCompilerOptions: Required<IValidatorCompilerOptions<any, any>> = {
  typeNarrowingEnabled: true,
  dialect: createJtdDialect(),
};
