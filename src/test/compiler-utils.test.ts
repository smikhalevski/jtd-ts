import {
  compileAccessor,
  compileDocComment,
  compileJsonPointer,
  compilePropertyName,
  createVarProvider,
} from '../main/compiler-utils';

describe('compileDocComment', () => {

  test('returns an empty string for an empty comment', () => {
    expect(compileDocComment(null)).toBe('');
    expect(compileDocComment(undefined)).toBe('');
    expect(compileDocComment('')).toBe('');
  });

  test('returns a doc comment', () => {
    expect(compileDocComment('Okay')).toBe(`\n/**\n * Okay\n */\n`);
  });

  test('returns a multiline doc comment', () => {
    expect(compileDocComment('Okay\nYay')).toBe(`\n/**\n * Okay\n * Yay\n */\n`);
  });
});

describe('compilePropertyName', () => {

  test('compiles identifier', () => {
    expect(compilePropertyName('okay')).toBe('okay');
    expect(compilePropertyName('$okay')).toBe('$okay');
    expect(compilePropertyName(' _okay')).toBe('" _okay"');
    expect(compilePropertyName('#$%@')).toBe('"#$%@"');
    expect(compilePropertyName('')).toBe('""');
  });

  test('compiles array index', () => {
    expect(compilePropertyName('123')).toBe('123');
    expect(compilePropertyName('0')).toBe('0');
    expect(compilePropertyName('0123')).toBe('"0123"');
    expect(compilePropertyName('0.123')).toBe('"0.123"');
  });
});

describe('compileJsonPointer', () => {

  test('compiles pointer', () => {
    expect(compileJsonPointer([{key: 'a'}, {key: 'b'}, {var: 'i'}, {key: 'c'}], 'esc')).toBe('"/a/b/"+esc(i)+"/c"');
  });

  test('compiles an empty pointer', () => {
    expect(compileJsonPointer([], 'esc')).toBe('');
  });

  test('compiles a single var', () => {
    expect(compileJsonPointer([{var: 'i'}], 'esc')).toBe('"/"+esc(i)');
  });

  test('compiles a single key', () => {
    expect(compileJsonPointer([{key: 'a'}], 'esc')).toBe('"/a"');
  });

  test('compiles a var and a key', () => {
    expect(compileJsonPointer([{var: 'i'}, {key: 'a'}], 'esc')).toBe('"/"+esc(i)+"/a"');
  });

  test('compiles a key and a var', () => {
    expect(compileJsonPointer([{key: 'a'}, {var: 'i'}], 'esc')).toBe('"/a/"+esc(i)');
  });

  test('escapes special chars', () => {
    expect(compileJsonPointer([{key: 'a/b'}, {key: 'c'}], 'esc')).toBe('"/a~1b/c"');
    expect(compileJsonPointer([{key: 'a~b'}, {key: 'c'}], 'esc')).toBe('"/a~0b/c"');
  });
});

describe('compileAccessor', () => {

  test('compiles accessor', () => {
    expect(compileAccessor([{key: 'a'}, {key: 'b'}, {var: 'i'}, {key: 'c'}])).toBe('.a.b[i].c');
  });

  test('compiles key accessor', () => {
    expect(compileAccessor([{key: 'a'}], true)).toBe('?.a');
    expect(compileAccessor([{key: 'a', optional: true}])).toBe('.a');
    expect(compileAccessor([{key: 'a', optional: true}, {key: 'b'}])).toBe('.a?.b');
    expect(compileAccessor([{key: '#$%@', optional: true}, {key: 'b'}])).toBe('["#$%@"]?.b');
  });

  test('compiles index accessor', () => {
    expect(compileAccessor([{key: '0'}], true)).toBe('?.[0]');
    expect(compileAccessor([{key: '0', optional: true}])).toBe('[0]');
    expect(compileAccessor([{key: '0', optional: true}, {key: 'b'}])).toBe('[0]?.b');
  });

  test('compiles string keys', () => {
    expect(compileAccessor(['a', '0', 'b'])).toBe('.a[0].b');
  });
});

describe('createVarProvider', () => {

  test('returns next var name', () => {
    const next = createVarProvider();

    expect(next()).toBe('a');
    expect(next()).toBe('b');

    for (let i = 3; i <= 25; i++) {
      next();
    }

    expect(next()).toBe('z');
    expect(next()).toBe('A');
    expect(next()).toBe('B');

    for (let i = 3; i <= 25; i++) {
      next();
    }

    expect(next()).toBe('Z');
    expect(next()).toBe('aa');

    for (let i = 1; i <= 24; i++) {
      next();
    }

    expect(next()).toBe('az');
    expect(next()).toBe('aA');

    for (let i = 1; i <= 24; i++) {
      next();
    }

    expect(next()).toBe('aZ');
    expect(next()).toBe('ba');

    for (let i = 1; i <= 1000; i++) {
      next();
    }

    expect(next()).toBe('un');
  });

  test('excludes names', () => {
    const next = createVarProvider(['b', 'c']);

    expect(next()).toBe('a');
    expect(next()).toBe('d');
  });
});
