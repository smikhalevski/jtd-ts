import {compileTsFromJtdDefinitions, ITsJtdMetadata} from '../main/jtd-ts';
import {parseJtdRoot} from '../main/jtd-ast';
import {JtdNodeType} from '../main/jtd-ast-types';

describe('compileTsFromJtdDefinitions', () => {

  test('compiles any type alias', () => {
    expect(compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {})))
        .toBe('export type Foo=any;');
  });

  test('compiles type definition', () => {
    expect(compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {type: 'string'})))
        .toBe('export type Foo=string;');
  });

  test('compiles nullable type definition', () => {
    expect(compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {type: 'string', nullable: true})))
        .toBe('export type Foo=string|null;');
  });

  test('compiles enum type', () => {
    expect(compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {properties: {bar: {enum: ['aaa', 'bbb']}}})))
        .toBe('export interface IFoo{bar:|"aaa"|"bbb";}');
  });

  test('compiles enum definition', () => {
    expect(compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {enum: ['foo', 'bar']})))
        .toBe('export enum Foo{FOO="foo",BAR="bar",}');
  });

  test('compiles array type', () => {
    expect(compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {properties: {bar: {elements: {type: 'string'}}}})))
        .toBe('export interface IFoo{bar:Array<string>;}');
  });

  test('compiles array alias declaration', () => {
    expect(compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {elements: {type: 'string'}})))
        .toBe('export type Foo=Array<string>;');
  });

  test('compiles record type', () => {
    expect(compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {properties: {bar: {values: {type: 'string'}}}})))
        .toBe('export interface IFoo{bar:Record<string,string>;}');
  });

  test('compiles record alias declaration', () => {
    expect(compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {values: {type: 'string'}})))
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
    })))
        .toBe('export interface IFoo{baz:{bar:string;qux?:number;};}');
  });

  test('compiles interface definition', () => {
    expect(compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {
      properties: {bar: {type: 'string'}},
      optionalProperties: {qux: {type: 'int16'}},
    })))
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
    })))
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
    }))).toBe('export type Foo=never');
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
    })))
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
    })))
        .toBe('export interface IFoo{baz:never;}');
  });

  test('adds quotes to illegal property names', () => {
    expect(compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {properties: {'@#$%': {}}})))
        .toBe('export interface IFoo{"@#$%":any;}');
  });

  test('adds comments to types', () => {
    expect(compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {metadata: {comment: 'Okay'}})))
        .toBe('\n/**\n * Okay\n */\nexport type Foo=any;');
  });

  test('adds comments to interfaces', () => {
    expect(compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {
      metadata: {comment: 'Okay'},
      properties: {},
    })))
        .toBe(`\n/**\n * Okay\n */\nexport interface IFoo{}`);
  });

  test('adds comments to object properties', () => {
    expect(compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {properties: {bar: {metadata: {comment: 'Okay'}}}})))
        .toBe(`export interface IFoo{\n/**\n * Okay\n */\nbar:any;}`);
  });

  test('resolves non-JTD types as never', () => {
    expect(compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {properties: {bar: {type: 'wow'}}})))
        .toBe('export interface IFoo{bar:never;}');
  });

  test('resolves external refs as never', () => {
    expect(compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {ref: 'wow'})))
        .toBe('export type Foo=never;');
  });

  test('resolves external refs with resolveRef', () => {
    const resolveRefFn = jest.fn();

    compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {ref: 'wow'}), {resolveRef: resolveRefFn});

    expect(resolveRefFn).toHaveBeenCalledTimes(1);
    expect(resolveRefFn).toHaveBeenNthCalledWith(1, 'wow', expect.objectContaining({nodeType: JtdNodeType.REF}));
  });

  test('resolves refs to local definitions', () => {
    expect(compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>('foo', {
      definitions: {wow: {type: 'string'}},
      ref: 'wow',
    })))
        .toBe('export type Wow=string;export type Foo=Wow;');
  });
});
