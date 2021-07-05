/**
 * Converts "foo bar" to "FooBar".
 */
export function pascalCase(str: string): string {
  return upperFirst(camelCase(str));
}

/**
 * Converts "foo bar" to "FOO_BAR".
 */
export function upperSnakeCase(str: string): string {
  return snakeCase(str).toUpperCase();
}

/**
 * Converts "foo bar" to "Foo bar".
 */
export function upperFirst(str: string): string {
  return str.length === 0 ? str : str.charAt(0).toUpperCase() + str.substr(1);
}

/**
 * Converts "foo bar" to "fooBar".
 */
export function camelCase(str: string): string {
  return reword(str, (word, index) => index === 0 ? word.toLowerCase() : upperFirst(word.toLowerCase()));
}

/**
 * Converts "foo bar" to "foo_bar".
 */
export function snakeCase(str: string): string {
  return reword(str, (word, index) => index === 0 ? word.toLowerCase() : '_' + word.toLowerCase());
}

const wordRe = /[^a-zA-Z]+|([A-Z]?[a-z]+(?=[^a-z])|[A-Z]{2,}(?=[^A-Z])|[a-zA-Z]+|\d+)/g;

export function reword(str: string, replacer: (word: string, index: number) => string): string {
  let index = 0;
  return str.replace(wordRe, (str, word) => word ? replacer(word, index++) : '');
}
