import {JtdNode, JtdNodeType} from '../jtd-ast-types';
import {ICheckerCompiler, ICheckerCompilerOptions, IValidatorCompilerOptions} from '../validator';
import {JtdType} from '../jtd-types';
import {CheckerRuntimeKey} from './runtime';

const jtdCheckerCompiler: ICheckerCompiler<any> = {
  runtimeModulePath: 'jtdc/lib/checker/runtime',
  compileChecker,
};

export default jtdCheckerCompiler;

/**
 * The compiler of the default checker.
 */
function compileChecker<M>(node: JtdNode<M>, checkerOptions: ICheckerCompilerOptions<M>, validatorOptions: Required<IValidatorCompilerOptions<M>>): string {
  const {
    wrapCache,
    contextVar,
    valueSrc,
    pointerSrc,
  } = checkerOptions;

  const {
    checkerRuntimeVar,
    renameValidator,
    rewriteEnumValue,
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
      return checkerHost + CheckerRuntimeKey.ENUM
          + '('
          + valueSrc
          + ',' + wrapCache('[' + node.values.map((value) => JSON.stringify(rewriteEnumValue(value, node))) + ']')
          + ',' + contextVar
          + ',' + pointerSrc
          + ')';

    case JtdNodeType.UNION:
    case JtdNodeType.OBJECT:
    case JtdNodeType.VALUES:
      return checkerHost + CheckerRuntimeKey.OBJECT + checkerArgs;

    case JtdNodeType.ELEMENTS:
      return checkerHost + CheckerRuntimeKey.ARRAY + checkerArgs;

    case JtdNodeType.NULLABLE:
      return valueSrc + '!==null';

    case JtdNodeType.TYPE:

      switch (node.type) {

        case JtdType.BOOLEAN:
          return checkerHost + CheckerRuntimeKey.BOOLEAN + checkerArgs;

        case JtdType.STRING:
        case JtdType.TIMESTAMP:
          return checkerHost + CheckerRuntimeKey.STRING + checkerArgs;

        case JtdType.FLOAT32:
        case JtdType.FLOAT64:
          return checkerHost + CheckerRuntimeKey.NUMBER + checkerArgs;

        case JtdType.INT8:
        case JtdType.UINT8:
        case JtdType.INT16:
        case JtdType.UINT16:
        case JtdType.INT32:
        case JtdType.UINT32:
          return checkerHost + CheckerRuntimeKey.INTEGER + checkerArgs;
      }

      throw new Error('Unexpected type: ' + node.type);
  }
}
