const separator = '/';

const encodeRe0 = /~/g;
const encodeRe1 = /\//g;
const encoded0 = '~0';
const encoded1 = '~1';

const decodeRe0 = /~0/g;
const decodeRe1 = /~1/g;
const decoded0 = '~';
const decoded1 = '\/';

export const JSON_POINTER_SEPARATOR = separator;

export function toJsonPointer(keys: string | number | Array<string | number>): string {
  if (Array.isArray(keys)) {
    let pointer = '';

    for (const key of keys) {
      pointer += toJsonPointer(key);
    }
    return pointer;
  }
  return separator + keys.toString().replace(encodeRe0, encoded0).replace(encodeRe1, encoded1);
}

export function fromJsonPointer(str: string): Array<string> {
  if (str.charAt(0) === separator) {
    str = str.substring(1);
  }
  return str.split(separator).map(decodeJsonPointer);
}

function decodeJsonPointer(str: string): string {
  return str.replace(decodeRe1, decoded1).replace(decodeRe0, decoded0);
}
