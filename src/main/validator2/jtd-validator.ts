import {IJtdNodeMap, JtdNode} from '../jtd-ast-types';
import {visitJtdNode} from '../jtd-visitor';

const ARG_VALUE = 'value';
const ARG_POINTER = 'pointer';

let abcIndex = 0;
let abc = 'abcdefghij';

export function compileValidatorBody<M>(node: JtdNode<M>) {

  let source = '';

  const nextVar = () => abc.charAt(abcIndex++);

  const valueVars: Array<string> = [ARG_VALUE];

  let pointer: string | {var: string} | undefined;
  let index = 0;
  let valueSrc = ARG_VALUE;

  const compileVars = () => {
    if (!pointer) {
      return '';
    }
    index++;
    const valueVar = valueVars[index] ||= nextVar();
    const source = `${valueVar}=${valueSrc};`;
    valueSrc = valueVar;
    return source;
  };

  const enterPointer = (p: string | {var: string}) => {
    pointer = p;
    valueSrc += typeof pointer === 'string' ? '.' + pointer : `[${pointer.var}]`;
  };

  const exitPointer = () => {
    if (!pointer) {
      index--;
    }
    pointer = undefined;
    valueSrc = valueVars[index];
  };

  visitJtdNode(node, {
    visitAny() {},
    visitRef() {},

    visitNullable(node, next) {
      source += `if(${valueSrc}!==null){`;
      next();
      source += '}';
    },

    visitType() {
      source += `checkType(${valueSrc});`;
    },

    visitEnum() {},
    visitEnumValue() {},
    visitElements() {},
    visitValues() {},

    visitObject(node, next) {
      if (hasValues(node.properties)) {
        source += compileVars()
            + `if(checkObject(${valueSrc})){`;
        next();
        source += '}';
      } else {
        source += `checkObject(${valueSrc});`;
      }
    },

    visitProperty(propKey, propNode, objectNode, next) {
      enterPointer(propKey);
      next();
      exitPointer();
    },

    visitOptionalProperty(propKey, propNode, objectNode, next) {
      source += compileVars()
          + `if(${valueSrc}!==undefined){`;
      next();
      source += '}';
    },

    visitUnion() {},
    visitUnionMapping() {},
  });

  return source;
}

function hasValues(nodeMap: IJtdNodeMap<any>): boolean {
  return Object.values(nodeMap).some((value) => value != null);
}
