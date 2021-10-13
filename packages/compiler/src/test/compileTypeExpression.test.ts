import {compileTypeExpression, typeExpressionCompilerConfig} from '../main/compileTypeExpression';
import {die} from '../main/misc';
import {JtdType} from '@jtdc/types/src/main';
import {parseJtd} from '../main/parseJtd';

describe('compileTypeExpression', () => {

  const refResolver = () => die('Unresolved ref');

  test('compiles any type', () => {
    const src = compileTypeExpression(parseJtd({}), refResolver, typeExpressionCompilerConfig);
    expect(src).toBe('any');
  });

  test('compiles ref type', () => {
    const src = compileTypeExpression(parseJtd({ref: 'bar'}), () => 'Foo', typeExpressionCompilerConfig);
    expect(src).toBe('Foo');
  });

  test('compiles nullable type', () => {
    const src = compileTypeExpression(parseJtd({nullable: true}), refResolver, typeExpressionCompilerConfig);
    expect(src).toBe('any|null');
  });

  test('compiles primitive type', () => {
    const src = compileTypeExpression(parseJtd({type: JtdType.INT8}), refResolver, typeExpressionCompilerConfig);
    expect(src).toBe('number');
  });

  test('compiles enum type', () => {
    const src = compileTypeExpression(parseJtd({enum: ['AAA', 'BBB']}), refResolver, typeExpressionCompilerConfig);
    expect(src).toBe('|"AAA"|"BBB"');
  });

  test('compiles array type', () => {
    const src = compileTypeExpression(parseJtd({elements: {type: JtdType.INT8}}), refResolver, typeExpressionCompilerConfig);
    expect(src).toBe('Array<number>');
  });

  test('compiles record type', () => {
    const src = compileTypeExpression(parseJtd({values: {type: JtdType.INT8}}), refResolver, typeExpressionCompilerConfig);
    expect(src).toBe('Record<string,number>');
  });

  test('compiles object type', () => {
    const src = compileTypeExpression(parseJtd({
      properties: {
        foo: {type: JtdType.INT8},
      },
    }), refResolver, typeExpressionCompilerConfig);

    expect(src).toBe('{foo:number;}');
  });

  test('compiles object type with optional properties', () => {
    const src = compileTypeExpression(parseJtd({
      optionalProperties: {
        foo: {type: JtdType.INT8},
      },
    }), refResolver, typeExpressionCompilerConfig);

    expect(src).toBe('{foo?:number;}');
  });

  test('compiles discriminated union type', () => {
    const src = compileTypeExpression(parseJtd({
      discriminator: 'bar',
      mapping: {
        AAA: {
          properties: {
            foo: {type: JtdType.STRING},
          },
        },
        BBB: {
          properties: {
            foo: {type: JtdType.INT8},
          },
        },
      },
    }), refResolver, typeExpressionCompilerConfig);

    expect(src).toBe('|{bar:"AAA";foo:string;}|{bar:"BBB";foo:number;}');
  });

  test('compiles discriminated union type with an empty mapping', () => {
    const src = compileTypeExpression(parseJtd({
      discriminator: 'bar',
      mapping: {},
    }), refResolver, typeExpressionCompilerConfig);
    expect(src).toBe('never');
  });
});
