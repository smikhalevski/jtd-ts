import {compileTsTypes} from '../main/ts-types-compiler';
import {parseJtdRoot} from '../main/jtd-ast';
import {JtdNodeType, JtdType} from '@jtdc/types';

describe('compileTsTypes', () => {

  test('compiles any type alias', () => {
    const src = compileTsTypes(parseJtdRoot('foo', {}));

    expect(src).toBe('export type Foo=any;');
  });

  test('compiles type definition', () => {
    const src = compileTsTypes(parseJtdRoot('foo', {
      type: JtdType.STRING,
    }));

    expect(src).toBe('export type Foo=string;');
  });

  test('compiles nullable type definition', () => {
    const src = compileTsTypes(parseJtdRoot('foo', {
      type: JtdType.STRING,
      nullable: true,
    }));

    expect(src).toBe('export type Foo=string|null;');
  });

  test('compiles enum type', () => {
    const src = compileTsTypes(parseJtdRoot('foo', {
      properties: {
        bar: {enum: ['aaa', 'bbb']},
      },
    }));

    expect(src).toBe('export interface Foo{bar:|"aaa"|"bbb";}');
  });

  test('compiles enum definition', () => {
    const src = compileTsTypes(parseJtdRoot('foo', {
      enum: ['foo', 'bar'],
    }));

    expect(src).toBe('enum Foo{FOO="foo",BAR="bar",}export{Foo};');
  });

  test('compiles array type', () => {
    const src = compileTsTypes(parseJtdRoot('foo', {
      properties: {
        bar: {
          elements: {type: JtdType.STRING},
        },
      },
    }));

    expect(src).toBe('export interface Foo{bar:Array<string>;}');
  });

  test('compiles array alias declaration', () => {
    const src = compileTsTypes(parseJtdRoot('foo', {
      elements: {type: JtdType.STRING},
    }));

    expect(src).toBe('export type Foo=Array<string>;');
  });

  test('compiles record type', () => {
    const src = compileTsTypes(parseJtdRoot('foo', {
      properties: {
        bar: {values: {type: JtdType.STRING}},
      },
    }));

    expect(src).toBe('export interface Foo{bar:Record<string,string>;}');
  });

  test('compiles record alias declaration', () => {
    const src = compileTsTypes(parseJtdRoot('foo', {
      values: {type: JtdType.STRING},
    }));

    expect(src).toBe('export type Foo=Record<string,string>;');
  });

  test('compiles object type', () => {
    const src = compileTsTypes(parseJtdRoot('foo', {
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
    }));

    expect(src).toBe('export interface Foo{baz:{bar:string;qux?:number;};}');
  });

  test('compiles interface definition', () => {
    const src = compileTsTypes(parseJtdRoot('foo', {
      properties: {
        bar: {type: JtdType.STRING},
      },
      optionalProperties: {
        qux: {type: JtdType.INT16},
      },
    }));

    expect(src).toBe('export interface Foo{bar:string;qux?:number;}');
  });

  test('compiles discriminated union definition', () => {
    const src = compileTsTypes(parseJtdRoot('foo', {
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
    }));

    expect(src).toBe(
        'enum FooType{AAA="AAA",BBB="BBB",}export{FooType};'
        + 'export type Foo=|FooAaa|FooBbb;'
        + 'export interface FooAaa{type:FooType.AAA;foo:string;}'
        + 'export interface FooBbb{type:FooType.BBB;bar:number;}',
    );
  });

  test('compiles never for discriminated union declaration with an empty mapping', () => {
    const src = compileTsTypes(parseJtdRoot('foo', {
      discriminator: 'type',
      mapping: {},
    }));

    expect(src).toBe('export type Foo=never;');
  });

  test('compiles discriminated union type', () => {
    const src = compileTsTypes(parseJtdRoot('foo', {
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
    }));

    expect(src).toBe(
        'export interface Foo{' +
        'baz:' +
        '|{type:"AAA";foo:string;}' +
        '|{type:"BBB";bar:number;};' +
        '}');
  });

  test('compiles never for discriminated union type with an empty mapping', () => {
    const src = compileTsTypes(parseJtdRoot('foo', {
      properties: {
        baz: {
          discriminator: 'type',
          mapping: {},
        },
      },
    }));

    expect(src).toBe('export interface Foo{baz:never;}');
  });

  test('adds quotes to illegal property names', () => {
    const src = compileTsTypes(parseJtdRoot('foo', {
      properties: {'@#$%': {}},
    }));

    expect(src).toBe('export interface Foo{"@#$%":any;}');
  });

  test('adds comments to types', () => {
    const src = compileTsTypes(parseJtdRoot('foo', {
      metadata: {comment: 'Okay'},
    }));

    expect(src).toBe('/**\n * Okay\n */export type Foo=any;');
  });

  test('adds comments to interfaces', () => {
    const src = compileTsTypes(parseJtdRoot('foo', {
      metadata: {comment: 'Okay'},
      properties: {},
    }));

    expect(src).toBe('/**\n * Okay\n */export interface Foo{}');
  });

  test('adds comments to object properties', () => {
    const src = compileTsTypes(parseJtdRoot('foo', {
      properties: {
        bar: {
          metadata: {comment: 'Okay'},
        },
      },
    }));

    expect(src).toBe(`export interface Foo{/**\n * Okay\n */bar:any;}`);
  });

  test('throws on unknown type', () => {
    expect(() => compileTsTypes(parseJtdRoot('foo', {
      properties: {
        bar: {type: 'wow'},
      },
    }))).toThrow();
  });

  test('throws on unknown external refs', () => {
    expect(() => compileTsTypes(parseJtdRoot('foo', {
      ref: 'wow',
    }))).toThrow();
  });

  test('resolves external refs with resolveRef', () => {
    const resolveExternalRefMock = jest.fn();

    const src = compileTsTypes(parseJtdRoot('foo', {
      ref: 'wow',
    }), {resolveExternalRef: resolveExternalRefMock});

    expect(resolveExternalRefMock).toHaveBeenCalledTimes(1);
    expect(resolveExternalRefMock).toHaveBeenNthCalledWith(1, expect.objectContaining({nodeType: JtdNodeType.REF}));
  });

  test('resolves refs to local definitions', () => {
    const src = compileTsTypes(parseJtdRoot('foo', {
      definitions: {
        wow: {type: JtdType.STRING},
      },
      ref: 'wow',
    }));

    expect(src).toBe('export type Wow=string;export type Foo=Wow;');
  });
});
