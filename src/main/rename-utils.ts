export function pascalCase(str: string): string {
  return upperFirst(camelCase(str));
}

export function upperSnakeCase(str: string): string {
  return snakeCase(str).toUpperCase();
}

export function upperFirst(str: string): string {
  return str.length === 0 ? str : str.charAt(0).toUpperCase() + str.substr(1);
}

export function camelCase(str: string): string {
  return replaceWords(str, (word, index) => index === 0 ? word.toLowerCase() : upperFirst(word.toLowerCase()));
}

export function snakeCase(str: string): string {
  return replaceWords(str, (word, index) => (index === 0 ? '' : '_') + word.toLowerCase());
}

const wordRe = /[^a-zA-Z]+|([A-Z]?[a-z]+(?=[^a-z])|[A-Z]{2,}(?=[^A-Z])|[a-zA-Z]+|\d+)/g;

export function replaceWords(str: string, replacer: (word: string, index: number) => string): string {
  let index = 0;
  return str.replace(wordRe, (str, word) => word ? replacer(word, index++) : '');
}
