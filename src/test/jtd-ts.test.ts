import {compileTsFromJtdDefinitions} from '../main/jtd-ts';
import {parseJtdRoot} from '../main/jtd-ast';
import {JtdNodeType} from '../main/jtd-ast-types';
import {JtdType} from '../main/jtd-types';

describe('compileTsFromJtdDefinitions', () => {

  test('compiles any type alias', () => {
    const src = compileTsFromJtdDefinitions(parseJtdRoot('foo', {}));

    expect(src).toBe('export type Foo=any;');
  });

  test('compiles type definition', () => {
    const src = compileTsFromJtdDefinitions(parseJtdRoot('foo', {
      type: JtdType.STRING,
    }));

    expect(src).toBe('export type Foo=string;');
  });

  test('compiles nullable type definition', () => {
    const src = compileTsFromJtdDefinitions(parseJtdRoot('foo', {
      type: JtdType.STRING,
      nullable: true,
    }));

    expect(src).toBe('export type Foo=string|null;');
  });

  test('compiles enum type', () => {
    const src = compileTsFromJtdDefinitions(parseJtdRoot('foo', {
      properties: {
        bar: {enum: ['aaa', 'bbb']},
      },
    }));

    expect(src).toBe('export interface IFoo{bar:|"aaa"|"bbb";}');
  });

  test('compiles enum definition', () => {
    const src = compileTsFromJtdDefinitions(parseJtdRoot('foo', {
      enum: ['foo', 'bar'],
    }));

    expect(src).toBe('enum Foo{FOO="foo",BAR="bar",}export{Foo};');
  });

  test('compiles array type', () => {
    const src = compileTsFromJtdDefinitions(parseJtdRoot('foo', {
      properties: {
        bar: {
          elements: {type: JtdType.STRING},
        },
      },
    }));

    expect(src).toBe('export interface IFoo{bar:Array<string>;}');
  });

  test('compiles array alias declaration', () => {
    const src = compileTsFromJtdDefinitions(parseJtdRoot('foo', {
      elements: {type: JtdType.STRING},
    }));

    expect(src).toBe('export type Foo=Array<string>;');
  });

  test('compiles record type', () => {
    const src = compileTsFromJtdDefinitions(parseJtdRoot('foo', {
      properties: {
        bar: {values: {type: JtdType.STRING}},
      },
    }));

    expect(src).toBe('export interface IFoo{bar:Record<string,string>;}');
  });

  test('compiles record alias declaration', () => {
    const src = compileTsFromJtdDefinitions(parseJtdRoot('foo', {
      values: {type: JtdType.STRING},
    }));

    expect(src).toBe('export type Foo=Record<string,string>;');
  });

  test('compiles object type', () => {
    const src = compileTsFromJtdDefinitions(parseJtdRoot('foo', {
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

    expect(src).toBe('export interface IFoo{baz:{bar:string;qux?:number;};}');
  });

  test('compiles interface definition', () => {
    const src = compileTsFromJtdDefinitions(parseJtdRoot('foo', {
      properties: {
        bar: {type: JtdType.STRING},
      },
      optionalProperties: {
        qux: {type: JtdType.INT16},
      },
    }));

    expect(src).toBe('export interface IFoo{bar:string;qux?:number;}');
  });

  test('compiles discriminated union definition', () => {
    const src = compileTsFromJtdDefinitions(parseJtdRoot('foo', {
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
        + 'export type Foo=|IFooAaa|IFooBbb;'
        + 'export interface IFooAaa{type:FooType.AAA;foo:string;}'
        + 'export interface IFooBbb{type:FooType.BBB;bar:number;}',
    );
  });

  test('compiles never for discriminated union declaration with an empty mapping', () => {
    const src = compileTsFromJtdDefinitions(parseJtdRoot('foo', {
      discriminator: 'type',
      mapping: {},
    }));

    expect(src).toBe('export type Foo=never;');
  });

  test('compiles discriminated union type', () => {
    const src = compileTsFromJtdDefinitions(parseJtdRoot('foo', {
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
        'export interface IFoo{' +
        'baz:' +
        '|{type:"AAA";foo:string;}' +
        '|{type:"BBB";bar:number;};' +
        '}');
  });

  test('compiles never for discriminated union type with an empty mapping', () => {
    const src = compileTsFromJtdDefinitions(parseJtdRoot('foo', {
      properties: {
        baz: {
          discriminator: 'type',
          mapping: {},
        },
      },
    }));

    expect(src).toBe('export interface IFoo{baz:never;}');
  });

  test('adds quotes to illegal property names', () => {
    const src = compileTsFromJtdDefinitions(parseJtdRoot('foo', {
      properties: {'@#$%': {}},
    }));

    expect(src).toBe('export interface IFoo{"@#$%":any;}');
  });

  test('adds comments to types', () => {
    const src = compileTsFromJtdDefinitions(parseJtdRoot('foo', {
      metadata: {comment: 'Okay'},
    }));

    expect(src).toBe('\n/**\n * Okay\n */\nexport type Foo=any;');
  });

  test('adds comments to interfaces', () => {
    const src = compileTsFromJtdDefinitions(parseJtdRoot('foo', {
      metadata: {comment: 'Okay'},
      properties: {},
    }));

    expect(src).toBe(`\n/**\n * Okay\n */\nexport interface IFoo{}`);
  });

  test('adds comments to object properties', () => {
    const src = compileTsFromJtdDefinitions(parseJtdRoot('foo', {
      properties: {
        bar: {
          metadata: {comment: 'Okay'},
        },
      },
    }));

    expect(src).toBe(`export interface IFoo{\n/**\n * Okay\n */\nbar:any;}`);
  });

  test('resolves non-JTD types as never', () => {
    const src = compileTsFromJtdDefinitions(parseJtdRoot('foo', {
      properties: {
        bar: {type: 'wow'},
      },
    }));

    expect(src).toBe('export interface IFoo{bar:never;}');
  });

  test('resolves external refs as never', () => {
    const src = compileTsFromJtdDefinitions(parseJtdRoot('foo', {
      ref: 'wow',
    }));

    expect(src).toBe('export type Foo=never;');
  });

  test('resolves external refs with resolveRef', () => {
    const resolveRefFn = jest.fn();

    const src = compileTsFromJtdDefinitions(parseJtdRoot('foo', {
      ref: 'wow',
    }), {resolveRef: resolveRefFn});

    expect(resolveRefFn).toHaveBeenCalledTimes(1);
    expect(resolveRefFn).toHaveBeenNthCalledWith(1, 'wow', expect.objectContaining({nodeType: JtdNodeType.REF}));
  });

  test('resolves refs to local definitions', () => {
    const src = compileTsFromJtdDefinitions(parseJtdRoot('foo', {
      definitions: {
        wow: {type: JtdType.STRING},
      },
      ref: 'wow',
    }));

    expect(src).toBe('export type Wow=string;export type Foo=Wow;');
  });
});
