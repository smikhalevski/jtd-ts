import {ModuleKind, transpileModule} from 'typescript';
import {compileValidators} from '../../main/validator/jtd-validator';
import {parseJtdRoot} from '../../main/jtd-ast';
import {JtdType} from '../../main/jtd-types';

function evalModule(source: string): Record<string, any> {
  return eval(`
    (function (exports) {
      ${transpileModule(source, {compilerOptions: {module: ModuleKind.CommonJS}}).outputText}
      return exports;
    })({});
  `);
}

describe('compileValidators', () => {

  test('compiles string type validator', () => {
    expect(compileValidators(parseJtdRoot('foo', {type: 'string'}))).toBe(
        'const validateFoo:v.Validator=(value,ctx,pointer)=>{'
        + 'ctx||={};'
        + 'pointer||="";'
        + 'c.s(value,ctx,pointer);'
        + 'return ctx.errors;'
        + '};'
        + 'export{validateFoo};',
    );
  });

  test('compiles type narrowing', () => {
    expect(compileValidators(parseJtdRoot('foo', {type: 'string'}), {
      resolveRef: () => 'Foo',
      emitsTypeNarrowing: true,
    })).toBe(
        'const validateFoo:v.Validator=(value,ctx,pointer)=>{'
        + 'ctx||={};'
        + 'pointer||="";'
        + 'c.s(value,ctx,pointer);'
        + 'return ctx.errors;'
        + '};'
        + 'const isFoo=(value:unknown):value is Foo=>!validateFoo(value,{lazy:true});'
        + 'export{validateFoo,isFoo};',
    );
  });

  test('compiles nullable type checker', () => {
    expect(compileValidators(parseJtdRoot('foo', {type: 'string', nullable: true}))).toBe(
        'const validateFoo:v.Validator=(value,ctx,pointer)=>{'
        + 'ctx||={};'
        + 'pointer||="";'
        + 'if(value!==null){'
        + 'c.s(value,ctx,pointer);'
        + '}'
        + 'return ctx.errors;'
        + '};'
        + 'export{validateFoo};',
    );
  });

  test('compiles reference checker', () => {
    expect(compileValidators(parseJtdRoot('foo', {ref: 'bar'}), {
      resolveRef: () => 'Bar',
    })).toBe(
        'const validateFoo:v.Validator=(value,ctx,pointer)=>{'
        + 'ctx||={};'
        + 'pointer||="";'
        + 'validateBar(value,ctx,pointer);'
        + 'return ctx.errors;'
        + '};'
        + 'export{validateFoo};',
    );
  });

  test('compiles enum checker', () => {
    expect(compileValidators(parseJtdRoot('foo', {enum: ['AAA', 'BBB']}))).toBe(
        'const validateFoo:v.Validator=(value,ctx,pointer)=>{'
        + 'ctx||={};'
        + 'pointer||="";'
        + 'let a=validateFoo.c||={};'
        + 'c.e(value,a.b||=["AAA","BBB"],ctx,pointer);'
        + 'return ctx.errors;'
        + '};'
        + 'export{validateFoo};',
    );
  });

  test('compiles elements checker', () => {
    expect(compileValidators(parseJtdRoot('foo', {elements: {type: 'string'}}))).toBe(
        'const validateFoo:v.Validator=(value,ctx,pointer)=>{'
        + 'ctx||={};'
        + 'pointer||="";'
        + 'if(c.a(value,ctx,pointer)){'
        + 'for(let a=0;a<value.length;a++){'
        + 'c.s(value[a],ctx,pointer+"/"+a);'
        + '}'
        + '}'
        + 'return ctx.errors;'
        + '};'
        + 'export{validateFoo};',
    );
  });

  test('compiles any elements checker', () => {
    expect(compileValidators(parseJtdRoot('foo', {elements: {}}))).toBe(
        'const validateFoo:v.Validator=(value,ctx,pointer)=>{'
        + 'ctx||={};'
        + 'pointer||="";'
        + 'c.a(value,ctx,pointer);'
        + 'return ctx.errors;'
        + '};'
        + 'export{validateFoo};',
    );
  });

  test('compiles values checker', () => {
    expect(compileValidators(parseJtdRoot('foo', {values: {type: 'string'}}))).toBe(
        'const validateFoo:v.Validator=(value,ctx,pointer)=>{'
        + 'ctx||={};'
        + 'pointer||="";'
        + 'if(c.o(value,ctx,pointer)){'
        + 'for(const a in value){'
        + 'c.s(value[a],ctx,pointer+"/"+v.p(a));'
        + '}'
        + '}'
        + 'return ctx.errors;'
        + '};'
        + 'export{validateFoo};',
    );
  });

  test('compiles any values checker', () => {
    expect(compileValidators(parseJtdRoot('foo', {values: {}}))).toBe(
        'const validateFoo:v.Validator=(value,ctx,pointer)=>{'
        + 'ctx||={};'
        + 'pointer||="";'
        + 'c.o(value,ctx,pointer);'
        + 'return ctx.errors;'
        + '};'
        + 'export{validateFoo};',
    );
  });

  test('compiles object properties validator', () => {
    expect(compileValidators(parseJtdRoot('foo', {
      properties: {
        foo: {type: JtdType.STRING},
      },
      optionalProperties: {
        bar: {type: JtdType.FLOAT32},
      },
    }))).toBe(
        'const validateFoo:v.Validator=(value,ctx,pointer)=>{'
        + 'ctx||={};'
        + 'pointer||="";'
        + 'let a,b;'
        + 'if(c.o(value,ctx,pointer)){'
        + 'c.s(value.foo,ctx,pointer+"/foo");'
        + 'a=value.bar;'
        + 'b=pointer+"/bar";'
        + 'if(a!==undefined){'
        + 'c.n(a,ctx,b);'
        + '}'
        + '}'
        + 'return ctx.errors;'
        + '};'
        + 'export{validateFoo};',
    );
  });

  test('compiles discriminated union validator', () => {
    expect(compileValidators(parseJtdRoot('foo', {
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
    }))).toBe(
        'const validateFoo:v.Validator=(value,ctx,pointer)=>{'
        + 'ctx||={};'
        + 'pointer||="";'
        + 'if(c.o(value,ctx,pointer)){'
        + 'switch(value.type){'
        + 'case "AAA":'
        + 'c.s(value.foo,ctx,pointer+"/foo");'
        + 'break;'
        + 'case "BBB":'
        + 'c.i(value.bar,ctx,pointer+"/bar");'
        + 'break;'
        + 'default:'
        + 'v.r(ctx,pointer+"/type")'
        + '}'
        + '}'
        + 'return ctx.errors;'
        + '};'
        + 'export{validateFoo};',
    );
  });

  test('compiles multiple validators', () => {
    expect(compileValidators(parseJtdRoot('foo', {
      definitions: {
        bar: {type: 'string'},
      },
      ref: 'bar',
    }))).toBe(
        'const validateBar:v.Validator=(value,ctx,pointer)=>{'
        + 'ctx||={};'
        + 'pointer||="";'
        + 'c.s(value,ctx,pointer);'
        + 'return ctx.errors;'
        + '};'
        + 'const validateFoo:v.Validator=(value,ctx,pointer)=>{'
        + 'ctx||={};'
        + 'pointer||="";'
        + 'validateBar(value,ctx,pointer);'
        + 'return ctx.errors;'
        + '};'
        + 'export{validateBar,validateFoo};',
    );
  });

  test('compiles nested', () => {
    expect(compileValidators(parseJtdRoot('foo', {
      properties: {
        aaa: {
          properties: {
            bbb: {
              type: JtdType.STRING,
            },
          },
        },
      },
    }))).toBe(
        'const validateFoo:v.Validator=(value,ctx,pointer)=>{'
        + 'ctx||={};'
        + 'pointer||="";'
        + 'let a,b;'
        + 'if(c.o(value,ctx,pointer)){'
        + 'a=value.aaa;'
        + 'b=pointer+"/aaa";'
        + 'if(c.o(a,ctx,b)){'
        + 'c.s(a.bbb,ctx,b+"/bbb");'
        + '}'
        + '}'
        + 'return ctx.errors;'
        + '};'
        + 'export{validateFoo};',
    );
  });

  /*test('compiles valid syntax', () => {

    const moduleSource = 'import lib from "../../main/validator/runtime";'
        + compileValidatorModuleProlog('lib')
        + compileValidators(parseJtdRoot('foo', {
          nullable: true,
          properties: {
            bar: {
              enum: ['AAA', 'BBB'],
            },
          },
        }), {emitsTypeNarrowing: true});

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
  });*/

});
