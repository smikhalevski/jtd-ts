import {JtdNode, JtdNodeType} from '../jtd-ast-types';
import {ICheckerCompiler, ICheckerOptions, IValidatorOptions} from '../validator/jtd-validator';
import {JtdType} from '../jtd-types';
import {CheckerName} from './runtime';

export const checkerCompiler: ICheckerCompiler<any> = {
  runtimeModulePath: 'jtdc/lib/checker/runtime',
  compileChecker,
};

/**
 * The compiler of the default checker.
 */
function compileChecker<M>(node: JtdNode<M>, checkerOptions: ICheckerOptions<M>, validatorOptions: Required<IValidatorOptions<M>>): string {
  const {
    wrapCache,
    contextVar,
    valueSrc,
    pointerSrc,
  } = checkerOptions;

  const {
    checkerRuntimeVar,
    rewriteEnumValue,
    renameValidator,
  } = validatorOptions;

  const checkerHost = checkerRuntimeVar + '.';

  const checkerArgs = '('
      + valueSrc
      + ',' + contextVar
      + ',' + pointerSrc
      + ')';

  switch (node.nodeType) {

    case JtdNodeType.ANY:
      return 'true';

    case JtdNodeType.REF:
      return renameValidator(node.ref, node) + checkerArgs;

    case JtdNodeType.ENUM:
      return checkerHost + CheckerName.ENUM
          + '('
          + valueSrc
          + ',' + wrapCache('[' + node.values.map((value) => JSON.stringify(rewriteEnumValue(value, node))) + ']')
          + ',' + contextVar
          + ',' + pointerSrc
          + ')';

    case JtdNodeType.UNION:
    case JtdNodeType.OBJECT:
    case JtdNodeType.VALUES:
      return checkerHost + CheckerName.OBJECT + checkerArgs;

    case JtdNodeType.ELEMENTS:
      return checkerHost + CheckerName.ARRAY + checkerArgs;

    case JtdNodeType.NULLABLE:
      return valueSrc + '!==null';

    case JtdNodeType.PROPERTY:
      return node.optional ? valueSrc + '!==undefined' : 'true';

    case JtdNodeType.MAPPING:
      throw new Error('Illegal state');

    case JtdNodeType.TYPE:

      switch (node.type) {

        case JtdType.BOOLEAN:
          return checkerHost + CheckerName.BOOLEAN + checkerArgs;

        case JtdType.STRING:
        case JtdType.TIMESTAMP:
          return checkerHost + CheckerName.STRING + checkerArgs;

        case JtdType.FLOAT32:
        case JtdType.FLOAT64:
          return checkerHost + CheckerName.NUMBER + checkerArgs;

        case JtdType.INT8:
        case JtdType.UINT8:
        case JtdType.INT16:
        case JtdType.UINT16:
        case JtdType.INT32:
        case JtdType.UINT32:
          return checkerHost + CheckerName.INTEGER + checkerArgs;
      }

      throw new Error('Unexpected type: ' + node.type);
  }
}
