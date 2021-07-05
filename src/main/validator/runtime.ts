import {RuntimeMethod} from './RuntimeMethod';
import {
  checkArray,
  checkBoolean,
  checkEnum,
  checkInteger,
  checkNumber,
  checkObject,
  checkString,
  escapeJsonPointer,
  raiseInvalid,
} from './validator-lib';

export {Validator} from './validator-types';

export default {
  [RuntimeMethod.CHECK_ENUM]: checkEnum,
  [RuntimeMethod.CHECK_ARRAY]: checkArray,
  [RuntimeMethod.CHECK_OBJECT]: checkObject,
  [RuntimeMethod.CHECK_STRING]: checkString,
  [RuntimeMethod.CHECK_NUMBER]: checkNumber,
  [RuntimeMethod.CHECK_INTEGER]: checkInteger,
  [RuntimeMethod.CHECK_BOOLEAN]: checkBoolean,
  [RuntimeMethod.RAISE_INVALID]: raiseInvalid,
  [RuntimeMethod.ESCAPE_JSON_POINTER]: escapeJsonPointer,
};
