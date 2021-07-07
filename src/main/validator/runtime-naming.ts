/**
 * Names exported by runtime
 */
export const enum RuntimeMethod {
  CHECK_ENUM = '__enum',
  CHECK_ARRAY = '__array',
  CHECK_OBJECT = '__object',
  CHECK_STRING = '__string',
  CHECK_NUMBER = '__number',
  CHECK_INTEGER = '__integer',
  CHECK_BOOLEAN = '__boolean',
  RAISE_INVALID = '__invalid',
  ESCAPE_JSON_POINTER = '__pointer',
  EXCLUDE = '__exclude',
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
  RuntimeMethod.EXCLUDE,
];

export const TYPE_VALIDATOR = '__Validator';

export const VAR_CACHE = '__cache';

export const VAR_RUNTIME = '__runtime';
