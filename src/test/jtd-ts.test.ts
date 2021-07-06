import {compileTsFromJtdDefinitions, ITsJtdMetadata, JtdNodeType, parseJtdRoot} from '../main';

describe('compileTsFromJtdDefinitions', () => {

  test('compiles any type alias', () => {
    expect(compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {})).source)
        .toBe('export type Foo=any;');
  });

  test('compiles type definition', () => {
    expect(compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {type: 'string'})).source)
        .toBe('export type Foo=string;');
  });

  test('compiles nullable type definition', () => {
    expect(compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {type: 'string', nullable: true})).source)
        .toBe('export type Foo=string|null;');
  });

  test('compiles enum type', () => {
    expect(compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {properties: {bar: {enum: ['aaa', 'bbb']}}})).source)
        .toBe('export interface IFoo{bar:|"aaa"|"bbb";}');
  });

  test('compiles enum definition', () => {
    expect(compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {enum: ['foo', 'bar']})).source)
        .toBe('export enum Foo{FOO="foo";BAR="bar";}');
  });

  test('compiles array type', () => {
    expect(compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {properties: {bar: {elements: {type: 'string'}}}})).source)
        .toBe('export interface IFoo{bar:Array<string>;}');
  });

  test('compiles array alias declaration', () => {
    expect(compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {elements: {type: 'string'}})).source)
        .toBe('export type Foo=Array<string>;');
  });

  test('compiles record type', () => {
    expect(compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {properties: {bar: {values: {type: 'string'}}}})).source)
        .toBe('export interface IFoo{bar:Record<string,string>;}');
  });

  test('compiles record alias declaration', () => {
    expect(compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {values: {type: 'string'}})).source)
        .toBe('export type Foo=Record<string,string>;');
  });

  test('compiles object type', () => {
    expect(compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {
      properties: {
        baz: {
          properties: {bar: {type: 'string'}},
          optionalProperties: {qux: {type: 'int16'}},
        },
      },
    })).source)
        .toBe('export interface IFoo{baz:{bar:string;qux?:number;};}');
  });

  test('compiles interface definition', () => {
    expect(compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {
      properties: {bar: {type: 'string'}},
      optionalProperties: {qux: {type: 'int16'}},
    })).source)
        .toBe('export interface IFoo{bar:string;qux:?number;}');
  });

  test('compiles discriminated union definition', () => {
    expect(compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {
      discriminator: 'type',
      mapping: {
        AAA: {
          properties: {
            foo: {type: 'string'},
          },
        },
        BBB: {
          properties: {
            bar: {type: 'int16'},
          },
        },
      },
    })).source)
        .toBe(
            'export enum FooType{BBB="BBB",}'
            + 'export type Foo=|IFooAaa|IFooBbb;'
            + 'export interface IFooAaa{type:FooType.AAA;foo:string;}'
            + 'export interface IFooBbb{type:FooType.BBB;bar:number;}');
  });

  test('compiles never for discriminated union declaration with an empty mapping', () => {
    expect(compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {
      discriminator: 'type',
      mapping: {},
    })).source).toBe('export type Foo=never');
  });

  test('compiles discriminated union type', () => {
    expect(compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {
      properties: {
        baz: {
          discriminator: 'type',
          mapping: {
            AAA: {
              properties: {
                foo: {type: 'string'},
              },
            },
            BBB: {
              properties: {
                bar: {type: 'int16'},
              },
            },
          },
        },
      },
    })).source)
        .toBe('export interface IFoo{baz:|{type:"AAA";foo:string;}|{type:"BBB";bar:number;};}');
  });

  test('compiles never for discriminated union type with an empty mapping', () => {
    expect(compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {
      properties: {
        baz: {
          discriminator: 'type',
          mapping: {},
        },
      },
    })).source)
        .toBe('export interface IFoo{baz:never;}');
  });

  test('adds quotes to illegal property names', () => {
    expect(compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {properties: {'@#$%': {}}})).source)
        .toBe('export interface IFoo{"@#$%":any;}');
  });

  test('adds comments to types', () => {
    expect(compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {metadata: {comment: 'Okay'}})).source)
        .toBe('\n/**\n * Okay\n */\nexport type Foo=any;');
  });

  test('adds comments to interfaces', () => {
    expect(compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {
      metadata: {comment: 'Okay'},
      properties: {},
    })).source)
        .toBe(`\n/**\n * Okay\n */\nexport interface IFoo{}`);
  });

  test('adds comments to object properties', () => {
    expect(compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {properties: {bar: {metadata: {comment: 'Okay'}}}})).source)
        .toBe(`export interface IFoo{\n/**\n * Okay\n */\nbar:any;}`);
  });

  test('resolves non-JTD types as never', () => {
    expect(compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {properties: {bar: {type: 'wow'}}})).source)
        .toBe('export interface IFoo{bar:never;}');
  });

  test('resolves external refs as never', () => {
    expect(compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {ref: 'wow'})).source)
        .toBe('export type Foo=never;');
  });

  test('resolves external refs with resolveRef', () => {
    const resolveRefFn = jest.fn();

    compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {ref: 'wow'}), {resolveRef: resolveRefFn}).source;

    expect(resolveRefFn).toHaveBeenCalledTimes(1);
    expect(resolveRefFn).toHaveBeenNthCalledWith(1, 'wow', expect.objectContaining({nodeType: JtdNodeType.REF}));
  });

  test('resolves refs to local definitions', () => {
    expect(compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {
      definitions: {wow: {type: 'string'}},
      ref: 'wow',
    })).source)
        .toBe('export type Wow=string;export type Foo=Wow;');
  });
});
