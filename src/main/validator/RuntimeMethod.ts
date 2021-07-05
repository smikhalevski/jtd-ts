export const enum RuntimeMethod {
  CHECK_ENUM = 'e',
  CHECK_ARRAY = 'a',
  CHECK_OBJECT = 'o',
  CHECK_STRING = 's',
  CHECK_NUMBER = 'n',
  CHECK_INTEGER = 'i',
  CHECK_BOOLEAN = 'b',
  RAISE_INVALID = 'r',
  ESCAPE_JSON_POINTER = 'p',
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
