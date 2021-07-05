/**
 * Names exported by runtime
 */
export const enum RuntimeMethod {
  CHECK_ENUM = '$enum',
  CHECK_ARRAY = '$array',
  CHECK_OBJECT = '$object',
  CHECK_STRING = '$string',
  CHECK_NUMBER = '$number',
  CHECK_INTEGER = '$integer',
  CHECK_BOOLEAN = '$boolean',
  RAISE_INVALID = '$raise',
  ESCAPE_JSON_POINTER = '$pointer',
}

export const runtimeMethod = [
  RuntimeMethod.CHECK_ENUM,
  RuntimeMethod.CHECK_ARRAY,
  RuntimeMethod.CHECK_OBJECT,
  RuntimeMethod.CHECK_STRING,
  RuntimeMethod.CHECK_NUMBER,
  RuntimeMethod.CHECK_INTEGER,
  RuntimeMethod.CHECK_BOOLEAN,
  RuntimeMethod.RAISE_INVALID,
  RuntimeMethod.ESCAPE_JSON_POINTER,
];

export const TYPE_VALIDATOR = '$Validator';

export const VAR_CACHE = '$validatorCache';
