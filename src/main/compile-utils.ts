import JsonPointer from 'json-pointer';

/**
 * Creates a callback that returns the next variable name when called.
 *
 * @param excludedVars The list of the excluded names.
 */
export function createVarProvider(excludedVars?: Array<string>): () => string {

  const fromCharCode = String.fromCharCode;
  const charCodes: Array<number> = [96 /*a - 1*/];

  const nextCharCode = (charCode: number): number => {
    return charCode === 122 /*z*/ ? 65 /*A*/ : charCode === 90 /*Z*/ ? -1 : charCode + 1;
  };

  const nextName = () => {
    let charCode = nextCharCode(charCodes[charCodes.length - 1]);

    if (charCode !== -1) {
      charCodes[charCodes.length - 1] = charCode;
      return fromCharCode(...charCodes);
    }

    for (let i = charCodes.length - 2; i > -1; i--) {
      const charCode = nextCharCode(charCodes[i]);

      if (charCode !== -1) {
        charCodes[i] = charCode;
        charCodes.fill(97 /*a*/, i + 1);
        return fromCharCode(...charCodes);
      }
    }

    charCodes.push(97 /*a*/);
    charCodes.fill(97 /*a*/);

    return fromCharCode(...charCodes);
  };

  return () => {
    let name = nextName();
    if (excludedVars?.length) {
      while (excludedVars.includes(name)) {
        name = nextName();
      }
    }
    return name;
  };
}

/**
 * Returns a source code of a doc comment.
 */
export function compileDocComment(comment: string | undefined | null): string {
  return comment ? `\n/**\n * ${comment.replace(/\n/g, '\n * ')}\n */\n` : '';
}

/**
 * Wraps given property name with quotes if needed so it can be used as a property name in an object declaration.
 */
export function compilePropertyName(name: string): string {
  return isIdentifier(name) || isArrayIndex(name) ? name : JSON.stringify(name);
}

/**
 * Returns `true` if `name` can be used as a JS identifier.
 */
export function isIdentifier(name: string): boolean {
  return /^[a-z_$][0-9a-z_$]*$/i.test(name);
}

/**
 * Returns `true` if `name` can be used as an array index.
 */
export function isArrayIndex(name: string): boolean {
  return /^0$|^[1-9]\d*$/.test(name);
}

/**
 * The reference to an object property defined by a literal key or by a variable name.
 */
export interface IPropertyRef {

  /**
   * The literal property key.
   */
  key?: string;

  /**
   * The name of the variable that holds the property key.
   */
  var?: string;
  optional?: boolean;
}

/**
 * Compiles a TS source that produces a JSON pointer string when evaluated.
 *
 * @param pointer The array of property refs that comprise the JSON pointer.
 * @param escapeVar The function that should be called to escape var-based property refs.
 *
 * @example
 * compileJsonPointer([{key: 'foo'}, {key: 'bar'}, {var: 'i'}], 'esc') // → '"/foo/bar/"+esc(i)'
 */
export function compileJsonPointer(pointer: Array<IPropertyRef>, escapeVar: string): string {
  let source = '';
  let i = 0;

  while (i < pointer.length) {
    const ref = pointer[i];

    if (i > 0) {
      source += '+';
    }

    if (ref.var) {
      if (i === 0) {
        source = '"/"+';
      }
      source += escapeVar + '(' + ref.var + ')';
      i++;
      continue;
    }

    let jsonPointer = '';
    let j = i;
    for (let ref; j < pointer.length; j++) {
      ref = pointer[j];
      if (ref.key) {
        jsonPointer += '/' + JsonPointer.escape(ref.key);
      } else {
        break;
      }
    }
    if (j < pointer.length) {
      jsonPointer += '/';
    }
    source += JSON.stringify(jsonPointer);
    i = j;
  }

  return source;
}

/**
 * Returns an accessor for the property described by a pointer.
 *
 * @param pointer The array of property refs that are accessed.
 * @param optional If `true` then first property is accessed from an optional object.
 *
 * @see https://tc39.es/ecma262/#sec-property-accessors Property Accessors
 *
 * @example
 * compilePropertyAccessor([{key: 'foo'}, {var: 'i', optional: true}, {key: 'бдыщ'}]) // → '.foo[i]?.["бдыщ"]'
 */
export function compileAccessor(pointer: Array<IPropertyRef | string>, optional?: boolean): string {
  let source = '';

  for (let i = 0; i < pointer.length; i++) {
    let ref = pointer[i];

    if (typeof ref === 'string') {
      ref = {key: ref};
    }

    if (optional) {
      source += '?.';
    }
    if (ref.key) {
      if (isIdentifier(ref.key)) {
        if (!optional) {
          source += '.';
        }
        source += ref.key;
      } else if (isArrayIndex(ref.key)) {
        source += '[' + ref.key + ']';
      } else {
        source += '[' + JSON.stringify(ref.key) + ']';
      }
    } else if (ref.var) {
      source += '[' + ref.var + ']';
    }

    optional = ref.optional;
  }
  return source;
}
