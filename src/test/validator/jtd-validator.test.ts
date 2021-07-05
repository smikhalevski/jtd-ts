import {compileValidatorModuleProlog, compileValidators, parseJtdRoot} from '../../main';
import {ModuleKind, transpileModule} from 'typescript';
import {RuntimeMethod, TYPE_VALIDATOR, VAR_CACHE} from '../../main/validator/runtime-naming';

function evalModule(source: string): Record<string, any> {
  return eval(`
    (function (exports) {
      ${transpileModule(source, {compilerOptions: {module: ModuleKind.CommonJS}}).outputText}
      return exports;
    })({});
  `);
}

describe('compileValidators', () => {

  test('compiles type validator', () => {
    expect(compileValidators(parseJtdRoot('foo', {type: 'string'}))).toBe(
        `export const validateFoo:${TYPE_VALIDATOR}=(value,errors=[],pointer="")=>{`
        + RuntimeMethod.CHECK_STRING + '(value,errors,pointer);'
        + 'return errors;'
        + '};',
    );
  });

  test('compiles type checker', () => {
    expect(compileValidators(parseJtdRoot('foo', {type: 'string'}), {emitsCheckers: true})).toBe(
        `export const validateFoo:${TYPE_VALIDATOR}=(value,errors=[],pointer="")=>{` +
        RuntimeMethod.CHECK_STRING + '(value,errors,pointer);' +
        'return errors;' +
        '};' +
        'export const isFoo=(value:unknown):value is Foo=>' +
        'validateFoo(value).length===0;',
    );
  });

  test('compiles nullable type validator', () => {
    expect(compileValidators(parseJtdRoot('foo', {type: 'string', nullable: true}))).toBe(
        `export const validateFoo:${TYPE_VALIDATOR}=(value,errors=[],pointer="")=>{`
        + 'if(value!==null){'
        + RuntimeMethod.CHECK_STRING + '(value,errors,pointer);'
        + '}'
        + 'return errors;'
        + '};',
    );
  });

  test('compiles validator reference', () => {
    expect(compileValidators(parseJtdRoot('foo', {ref: 'bar'}))).toBe(
        `export const validateFoo:${TYPE_VALIDATOR}=(value,errors=[],pointer="")=>{`
        + 'validateBar(value,errors,pointer);'
        + 'return errors;'
        + '};',
    );
  });

  test('compiles enum validator', () => {
    expect(compileValidators(parseJtdRoot('foo', {enum: ['AAA', 'BBB']}))).toBe(
        `export const validateFoo:${TYPE_VALIDATOR}=(value,errors=[],pointer="")=>{`
        + `${RuntimeMethod.CHECK_ENUM}(value,${VAR_CACHE}["foo.a"]||=new Set(["AAA","BBB"]),errors,pointer);`
        + 'return errors;'
        + '};',
    );
  });

  test('compiles elements validator', () => {
    expect(compileValidators(parseJtdRoot('foo', {elements: {type: 'string'}}))).toBe(
        `export const validateFoo:${TYPE_VALIDATOR}=(value,errors=[],pointer="")=>{`
        + `if(${RuntimeMethod.CHECK_ARRAY}(value,errors,pointer)){`
        + 'for(let a=0;a<value.length;a++){'
        + `${RuntimeMethod.CHECK_STRING}(value[a],errors,pointer+"/"+${RuntimeMethod.ESCAPE_JSON_POINTER}(a));`
        + '}'
        + '}'
        + 'return errors;'
        + '};',
    );
  });

  test('compiles any elements validator', () => {
    expect(compileValidators(parseJtdRoot('foo', {elements: {}}))).toBe(
        `export const validateFoo:${TYPE_VALIDATOR}=(value,errors=[],pointer="")=>{`
        + `${RuntimeMethod.CHECK_ARRAY}(value,errors,pointer);`
        + 'return errors;'
        + '};',
    );
  });

  test('compiles values validator', () => {
    expect(compileValidators(parseJtdRoot('foo', {values: {type: 'string'}}))).toBe(
        `export const validateFoo:${TYPE_VALIDATOR}=(value,errors=[],pointer="")=>{`
        + `if(${RuntimeMethod.CHECK_OBJECT}(value,errors,pointer)){`
        + 'for(const a in value){'
        + `${RuntimeMethod.CHECK_STRING}(value[a],errors,pointer+"/"+${RuntimeMethod.ESCAPE_JSON_POINTER}(a));`
        + '}'
        + '}'
        + 'return errors;'
        + '};',
    );
  });

  test('compiles any values validator', () => {
    expect(compileValidators(parseJtdRoot('foo', {values: {}}))).toBe(
        `export const validateFoo:${TYPE_VALIDATOR}=(value,errors=[],pointer="")=>{`
        + `${RuntimeMethod.CHECK_OBJECT}(value,errors,pointer);`
        + 'return errors;'
        + '};',
    );
  });

  test('compiles object properties validator', () => {
    expect(compileValidators(parseJtdRoot('foo', {
      properties: {foo: {type: 'string'}},
      optionalProperties: {bar: {type: 'float32'}},
    }))).toBe(
        `export const validateFoo:${TYPE_VALIDATOR}=(value,errors=[],pointer="")=>{`
        + `if(${RuntimeMethod.CHECK_OBJECT}(value,errors,pointer)){`
        + RuntimeMethod.CHECK_STRING + '(value.foo,errors,pointer+"/foo");'
        + 'if(value.bar!==undefined){'
        + `${RuntimeMethod.CHECK_NUMBER}(value.bar,errors,pointer+"/bar");`
        + '}'
        + '}'
        + 'return errors;'
        + '};',
    );
  });

  test('compiles discriminated union validator', () => {
    expect(compileValidators(parseJtdRoot('foo', {
      discriminator: 'type',
      mapping: {
        AAA: {
          properties: {foo: {type: 'string'}},
        },
        BBB: {
          properties: {bar: {type: 'int16'}},
        },
      },
    }))).toBe(
        `export const validateFoo:${TYPE_VALIDATOR}=(value,errors=[],pointer="")=>{`
        + `if(${RuntimeMethod.CHECK_OBJECT}(value,errors,pointer)){`
        + 'switch(value.type){'
        + 'case "AAA":'
        + `${RuntimeMethod.CHECK_STRING}(value.foo,errors,pointer+"/foo");`
        + 'break;'
        + 'case "BBB":'
        + `${RuntimeMethod.CHECK_INTEGER}(value.bar,errors,pointer+"/bar");`
        + 'break;'
        + 'default:'
        + `${RuntimeMethod.RAISE_INVALID}(errors,pointer+"/type");`
        + '}'
        + '}'
        + 'return errors;'
        + '};',
    );
  });

  test('compiles multiple validators', () => {
    expect(compileValidators(parseJtdRoot('foo', {
      definitions: {
        bar: {type: 'string'},
      },
      ref: 'bar',
    }))).toBe(
        `export const validateBar:${TYPE_VALIDATOR}=(value,errors=[],pointer="")=>{`
        + RuntimeMethod.CHECK_STRING + '(value,errors,pointer);'
        + 'return errors;'
        + '};'
        + `export const validateFoo:${TYPE_VALIDATOR}=(value,errors=[],pointer="")=>{`
        + 'validateBar(value,errors,pointer);'
        + 'return errors;'
        + '};',
    );
  });

  test('compiles valid syntax', () => {

    const moduleSource = 'import lib from "../../main/validator/runtime";'
        + compileValidatorModuleProlog('lib')
        + compileValidators(parseJtdRoot('foo', {
          nullable: true,
          properties: {
            bar: {
              enum: ['AAA', 'BBB'],
            },
          },
        }), {emitsCheckers: true});

    const module = evalModule(moduleSource);

    expect(module.validateFoo(null)).toEqual([]);

    expect(module.validateFoo({bar: 'AAA'})).toEqual([]);

    expect(module.validateFoo({})).toEqual([
      {pointer: '/bar', code: 'required'},
    ]);

    expect(module.validateFoo({bar: 'CCC'})).toEqual([
      {pointer: '/bar', code: 'invalid'},
    ]);

    expect(module.isFoo(null)).toBe(true);

    expect(module.isFoo({})).toBe(false);

    expect(module.isFoo({bar: 'AAA'})).toBe(true);
  });

});
