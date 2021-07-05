import {RuntimeMethod} from './runtime-naming';
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
} from './runtime-lib';

export * from './validator-types';

const runtime = {
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

/**
 * The runtime used by compiled validators.
 */
export default runtime;
