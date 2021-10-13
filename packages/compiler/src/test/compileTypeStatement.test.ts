import {compileTypeStatement, typeStatementCompilerConfig} from '../main/compileTypeStatement';
import {JtdType} from '@jtdc/types';
import {die} from '../main/misc';
import {parseJtd} from '../main/parseJtd';

describe('compileTypeStatement', () => {

  const refResolver = () => die('Unresolved ref');

  test('compiles any type alias', () => {
    const src = compileTypeStatement('foo', parseJtd({}), refResolver, typeStatementCompilerConfig);
    expect(src).toBe('export type Foo=any;');
  });

  test('compiles type', () => {
    const src = compileTypeStatement('foo', parseJtd({
      type: JtdType.STRING,
    }), refResolver, typeStatementCompilerConfig);

    expect(src).toBe('export type Foo=string;');
  });

  test('compiles nullable type', () => {
    const src = compileTypeStatement('foo', parseJtd({
      type: JtdType.STRING,
      nullable: true,
    }), refResolver, typeStatementCompilerConfig);

    expect(src).toBe('export type Foo=string|null;');
  });

  test('compiles enum type', () => {
    const src = compileTypeStatement('foo', parseJtd({
      properties: {
        bar: {enum: ['aaa', 'bbb']},
      },
    }), refResolver, typeStatementCompilerConfig);

    expect(src).toBe('export interface Foo{bar:|"aaa"|"bbb";}');
  });

  test('compiles enum', () => {
    const src = compileTypeStatement('foo', parseJtd({
      enum: ['foo', 'bar'],
    }), refResolver, typeStatementCompilerConfig);

    expect(src).toBe('export enum Foo{FOO="foo",BAR="bar",}');
  });

  test('compiles array type', () => {
    const src = compileTypeStatement('foo', parseJtd({
      properties: {
        bar: {
          elements: {type: JtdType.STRING},
        },
      },
    }), refResolver, typeStatementCompilerConfig);

    expect(src).toBe('export interface Foo{bar:Array<string>;}');
  });

  test('compiles array alias', () => {
    const src = compileTypeStatement('foo', parseJtd({
      elements: {type: JtdType.STRING},
    }), refResolver, typeStatementCompilerConfig);

    expect(src).toBe('export type Foo=Array<string>;');
  });

  test('compiles record type', () => {
    const src = compileTypeStatement('foo', parseJtd({
      properties: {
        bar: {values: {type: JtdType.STRING}},
      },
    }), refResolver, typeStatementCompilerConfig);

    expect(src).toBe('export interface Foo{bar:Record<string,string>;}');
  });

  test('compiles record type alias', () => {
    const src = compileTypeStatement('foo', parseJtd({
      values: {type: JtdType.STRING},
    }), refResolver, typeStatementCompilerConfig);

    expect(src).toBe('export type Foo=Record<string,string>;');
  });

  test('compiles object type', () => {
    const src = compileTypeStatement('foo', parseJtd({
      properties: {
        baz: {
          properties: {
            bar: {type: JtdType.STRING},
          },
          optionalProperties: {
            qux: {type: JtdType.INT16},
          },
        },
      },
    }), refResolver, typeStatementCompilerConfig);

    expect(src).toBe('export interface Foo{baz:{bar:string;qux?:number;};}');
  });

  test('compiles interface', () => {
    const src = compileTypeStatement('foo', parseJtd({
      properties: {
        bar: {type: JtdType.STRING},
      },
      optionalProperties: {
        qux: {type: JtdType.INT16},
      },
    }), refResolver, typeStatementCompilerConfig);

    expect(src).toBe('export interface Foo{bar:string;qux?:number;}');
  });

  test('compiles discriminated union', () => {
    const src = compileTypeStatement('foo', parseJtd({
      discriminator: 'type',
      mapping: {
        AAA: {
          properties: {
            foo: {type: JtdType.STRING},
          },
        },
        BBB: {
          properties: {
            bar: {type: JtdType.INT16},
          },
        },
      },
    }), refResolver, typeStatementCompilerConfig);

    expect(src).toBe(
        'export enum FooType{AAA="AAA",BBB="BBB",}'
        + 'export type Foo=|FooAaa|FooBbb;'
        + 'export interface FooAaa{type:FooType.AAA;foo:string;}'
        + 'export interface FooBbb{type:FooType.BBB;bar:number;}',
    );
  });

  test('compiles never for discriminated union with an empty mapping', () => {
    const src = compileTypeStatement('foo', parseJtd({
      discriminator: 'type',
      mapping: {},
    }), refResolver, typeStatementCompilerConfig);

    expect(src).toBe('export type Foo=never;');
  });

  test('compiles discriminated union type', () => {
    const src = compileTypeStatement('foo', parseJtd({
      properties: {
        baz: {
          discriminator: 'type',
          mapping: {
            AAA: {
              properties: {
                foo: {type: JtdType.STRING},
              },
            },
            BBB: {
              properties: {
                bar: {type: JtdType.INT16},
              },
            },
          },
        },
      },
    }), refResolver, typeStatementCompilerConfig);

    expect(src).toBe(
        'export interface Foo{' +
        'baz:' +
        '|{type:"AAA";foo:string;}' +
        '|{type:"BBB";bar:number;};' +
        '}');
  });

  test('compiles never for discriminated union type with an empty mapping', () => {
    const src = compileTypeStatement('foo', parseJtd({
      properties: {
        baz: {
          discriminator: 'type',
          mapping: {},
        },
      },
    }), refResolver, typeStatementCompilerConfig);

    expect(src).toBe('export interface Foo{baz:never;}');
  });

  test('adds quotes to illegal property names', () => {
    const src = compileTypeStatement('foo', parseJtd({
      properties: {'@#$%': {}},
    }), refResolver, typeStatementCompilerConfig);

    expect(src).toBe('export interface Foo{"@#$%":any;}');
  });

  test('adds comments to types', () => {
    const src = compileTypeStatement('foo', parseJtd({
      metadata: {comment: 'Okay'},
    }), refResolver, typeStatementCompilerConfig);

    expect(src).toBe('/**\n * Okay\n */export type Foo=any;');
  });

  test('adds comments to interfaces', () => {
    const src = compileTypeStatement('foo', parseJtd({
      metadata: {comment: 'Okay'},
      properties: {},
    }), refResolver, typeStatementCompilerConfig);

    expect(src).toBe('/**\n * Okay\n */export interface Foo{}');
  });

  test('adds comments to object properties', () => {
    const src = compileTypeStatement('foo', parseJtd({
      properties: {
        bar: {
          metadata: {comment: 'Okay'},
        },
      },
    }), refResolver, typeStatementCompilerConfig);

    expect(src).toBe(`export interface Foo{/**\n * Okay\n */bar:any;}`);
  });

  test('throws on unknown type', () => {
    expect(() => compileTypeStatement('foo', parseJtd({
      properties: {
        bar: {type: 'wow'},
      },
    }), refResolver, typeStatementCompilerConfig)).toThrow();
  });

  test('compiles ref type alias', () => {
    const src = compileTypeStatement('foo', parseJtd({
      ref: 'wow',
    }), () => 'Bar', typeStatementCompilerConfig);

    expect(src).toBe('export type Foo=Bar;');
  });
});
