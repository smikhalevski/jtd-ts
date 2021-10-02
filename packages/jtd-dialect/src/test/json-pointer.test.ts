import {fromJsonPointer, toJsonPointer} from '../main/json-pointer';

describe('toJsonPointer', () => {

  test('encodes key', () => {
    expect(toJsonPointer('aaa')).toBe('/aaa');
    expect(toJsonPointer(123)).toBe('/123');
    expect(toJsonPointer('~')).toBe('/~0');
    expect(toJsonPointer('\/')).toBe('/~1');
    expect(toJsonPointer('aaa~\/~\/bbb')).toBe('/aaa~0~1~0~1bbb');
  });

  test('encodes array of keys', () => {
    expect(toJsonPointer(['a', 'aaa'])).toBe('/a/aaa');
    expect(toJsonPointer(['a', 123])).toBe('/a/123');
    expect(toJsonPointer(['a', '~'])).toBe('/a/~0');
    expect(toJsonPointer(['a', '\/'])).toBe('/a/~1');
    expect(toJsonPointer(['a', 'aaa~\/~\/bbb'])).toBe('/a/aaa~0~1~0~1bbb');
  });

  test('encodes empty keys', () => {
    expect(toJsonPointer([])).toBe('');
  });
});

describe('fromJsonPointer', () => {

  test('decodes pointer', () => {
    expect(fromJsonPointer(toJsonPointer(['a', 'aaa']))).toEqual(['a', 'aaa']);
    expect(fromJsonPointer(toJsonPointer(['a', 123]))).toEqual(['a', '123']);
    expect(fromJsonPointer(toJsonPointer(['a', '~']))).toEqual(['a', '~']);
    expect(fromJsonPointer(toJsonPointer(['a', '\/']))).toEqual(['a', '\/']);
    expect(fromJsonPointer(toJsonPointer(['a', 'aaa~\/~\/bbb']))).toEqual(['a', 'aaa~\/~\/bbb']);
  });
});
