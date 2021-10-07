export const JSON_POINTER_SEPARATOR = '/';

export function toJsonPointer(keys: string | number | Array<string | number>): string {
  if (!Array.isArray(keys)) {
    return JSON_POINTER_SEPARATOR + encodeKey(keys + '');
  }
  let pointer = '';

  for (const key of keys) {
    pointer += JSON_POINTER_SEPARATOR + encodeKey(key + '');
  }
  return pointer;
}

export function fromJsonPointer(str: string): Array<string> {
  if (str.length === 0) {
    return [];
  }
  if (str.charAt(0) === JSON_POINTER_SEPARATOR) {
    str = str.substring(1);
  }
  return str.split(JSON_POINTER_SEPARATOR).map(decodeKey);
}

function encodeKey(str: string): string {
  return str.replaceAll('~', '~0').replaceAll('/', '~1');
}

function decodeKey(str: string): string {
  return str.replaceAll('~1', '/').replaceAll('~0', '~');
}
