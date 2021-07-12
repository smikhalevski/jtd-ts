import {ModuleKind, transpileModule} from 'typescript';
import {compileValidators} from '../main/validators-compiler';
import {parseJtdRoot} from '../main/jtd-ast';
import {JtdType} from '../main/jtd-types';

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
    expect(compileValidators(parseJtdRoot('foo', {type: JtdType.STRING}), {typeGuardsRendered: true})).toBe(
        'const validateFoo:_r.Validator=(a,b,c)=>{'
        + 'b=b||{};'
        + '_r.s(a,b,c||"");'
        + 'return b.errors;'
        + '};'
        + 'export{validateFoo};'
        + 'const isFoo=(value:unknown):value is Foo=>!validateFoo(value,{shallow:true});'
        + 'export{isFoo};',
    );
  });

  test('compiles nullable checker', () => {
    expect(compileValidators(parseJtdRoot('foo', {
      type: JtdType.STRING,
      nullable: true,
    }))).toBe(
        'const validateFoo:_r.Validator=(a,b,c)=>{'
        + 'b=b||{};'
        + 'if(a!==null){'
        + '_r.s(a,b,c||"");'
        + '}'
        + 'return b.errors;'
        + '};'
        + 'export{validateFoo};',
    );
  });

  test('compiles nullable any checker', () => {
    expect(compileValidators(parseJtdRoot('foo', {nullable: true}))).toBe(
        'const validateFoo:_r.Validator=(a,b,c)=>{'
        + 'b=b||{};'
        + 'return b.errors;'
        + '};'
        + 'export{validateFoo};',
    );
  });

  test('compiles reference checker', () => {
    expect(compileValidators(parseJtdRoot('foo', {ref: 'bar'}))).toBe(
        'const validateFoo:_r.Validator=(a,b,c)=>{'
        + 'b=b||{};'
        + 'validateBar(a,b,c||"");'
        + 'return b.errors;'
        + '};'
        + 'export{validateFoo};',
    );
  });

  test('compiles enum checker', () => {
    expect(compileValidators(parseJtdRoot('foo', {enum: ['AAA', 'BBB']}))).toBe(
        'const validateFoo:_r.Validator=(a,b,c)=>{'
        + 'b=b||{};'
        + '_r.e(a,(validateFoo.cache||={}).a||=["AAA","BBB"],b,c||"");'
        + 'return b.errors;'
        + '};'
        + 'export{validateFoo};',
    );
  });

  test('compiles elements checker', () => {
    expect(compileValidators(parseJtdRoot('foo', {elements: {type: JtdType.STRING}}))).toBe(
        'const validateFoo:_r.Validator=(a,b,c)=>{'
        + 'let d;'
        + 'b=b||{};'
        + 'c=c||"";'
        + 'if(_r.a(a,b,c)){'
        + 'for(d=0;d<a.length;d++){'
        + '_r.s(a[d],b,c+d);'
        + '}'
        + '}'
        + 'return b.errors;'
        + '};'
        + 'export{validateFoo};',
    );
  });

  test('compiles any elements checker', () => {
    expect(compileValidators(parseJtdRoot('foo', {elements: {}}))).toBe(
        'const validateFoo:_r.Validator=(a,b,c)=>{'
        + 'b=b||{};'
        + '_r.a(a,b,c||"");'
        + 'return b.errors;'
        + '};'
        + 'export{validateFoo};',
    );
  });

  test('compiles values checker', () => {
    expect(compileValidators(parseJtdRoot('foo', {values: {type: JtdType.STRING}}))).toBe(
        'const validateFoo:_r.Validator=(a,b,c)=>{'
        + 'let d;'
        + 'b=b||{};'
        + 'c=c||"";'
        + 'if(_r.o(a,b,c)){'
        + 'for(d in a){'
        + '_r.s(a[d],b,c+_r.p(d));'
        + '}'
        + '}'
        + 'return b.errors;'
        + '};'
        + 'export{validateFoo};',
    );
  });

  test('compiles any values checker', () => {
    expect(compileValidators(parseJtdRoot('foo', {values: {}}))).toBe(
        'const validateFoo:_r.Validator=(a,b,c)=>{'
        + 'b=b||{};'
        + '_r.o(a,b,c||"");'
        + 'return b.errors;'
        + '};'
        + 'export{validateFoo};',
    );
  });

  test('compiles object properties checker', () => {
    expect(compileValidators(parseJtdRoot('foo', {
      properties: {
        foo: {type: JtdType.STRING},
      },
      optionalProperties: {
        bar: {type: JtdType.FLOAT32},
      },
    }))).toBe(
        'const validateFoo:_r.Validator=(a,b,c)=>{'
        + 'let d;'
        + 'b=b||{};'
        + 'c=c||"";'
        + 'if(_r.o(a,b,c)){'
        + '_r.s(a.foo,b,c+"/foo");'
        + 'd=a.bar;'
        + 'if(d!==undefined){'
        + '_r.n(d,b,c+"/bar");'
        + '}'
        + '}'
        + 'return b.errors;'
        + '};'
        + 'export{validateFoo};',
    );
  });

  test('compiles multiple optional properties', () => {
    expect(compileValidators(parseJtdRoot('foo', {
      optionalProperties: {
        foo: {type: JtdType.STRING},
        bar: {type: JtdType.FLOAT32},
      },
    }))).toBe(
        'const validateFoo:_r.Validator=(a,b,c)=>{'
        + 'let d,e;'
        + 'b=b||{};'
        + 'c=c||"";'
        + 'if(_r.o(a,b,c)){'
        + 'd=a.foo;'
        + 'if(d!==undefined){'
        + '_r.s(d,b,c+"/foo");'
        + '}'
        + 'e=a.bar;'
        + 'if(e!==undefined){'
        + '_r.n(e,b,c+"/bar");'
        + '}'
        + '}'
        + 'return b.errors;'
        + '};'
        + 'export{validateFoo};',
    );
  });

  test('compiles discriminated union checker', () => {
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
        'const validateFoo:_r.Validator=(a,b,c)=>{'
        + 'b=b||{};'
        + 'c=c||"";'
        + 'if(_r.o(a,b,c)){'
        + 'switch(a.type){'
        + 'case "AAA":'
        + '_r.s(a.foo,b,c+"/foo");'
        + 'break;'
        + 'case "BBB":'
        + '_r.i(a.bar,b,c+"/bar");'
        + 'break;'
        + 'default:'
        + '_r.r(b,c+"/type")'
        + '}'
        + '}'
        + 'return b.errors;'
        + '};'
        + 'export{validateFoo};',
    );
  });

  test('compiles multiple validators', () => {
    expect(compileValidators(parseJtdRoot('foo', {
      definitions: {
        bar: {type: JtdType.STRING},
      },
      ref: 'bar',
    }))).toBe(
        'const validateBar:_r.Validator=(a,b,c)=>{'
        + 'b=b||{};'
        + '_r.s(a,b,c||"");'
        + 'return b.errors;'
        + '};'
        + 'export{validateBar};'
        + 'const validateFoo:_r.Validator=(a,b,c)=>{'
        + 'b=b||{};'
        + 'validateBar(a,b,c||"");'
        + 'return b.errors;'
        + '};'
        + 'export{validateFoo};',
    );
  });

  test('compiles nested objects', () => {
    expect(compileValidators(parseJtdRoot('foo', {
      properties: {
        aaa: {
          properties: {
            bbb: {type: JtdType.STRING},
          },
        },
      },
    }))).toBe(
        'const validateFoo:_r.Validator=(a,b,c)=>{'
        + 'let d,e;'
        + 'b=b||{};'
        + 'c=c||"";'
        + 'if(_r.o(a,b,c)){'
        + 'd=a.aaa;'
        + 'e=c+"/aaa";'
        + 'if(_r.o(d,b,e)){'
        + '_r.s(d.bbb,b,e+"/bbb");'
        + '}'
        + '}'
        + 'return b.errors;'
        + '};'
        + 'export{validateFoo};',
    );
  });

  test('compiles nested elements and values', () => {
    expect(compileValidators(parseJtdRoot('foo', {
      elements: {
        values: {
          properties: {
            foo: {type: JtdType.STRING},
            bar: {type: JtdType.INT16},
          },
        },
      },
    }))).toBe(
        'const validateFoo:_r.Validator=(a,b,c)=>{'
        + 'let d,e,f,g,h,i;'
        + 'b=b||{};'
        + 'c=c||"";'
        + 'if(_r.a(a,b,c)){'
        + 'for(d=0;d<a.length;d++){'
        + 'e=a[d];'
        + 'f=c+d;'
        + 'if(_r.o(e,b,f)){'
        + 'for(g in e){'
        + 'h=e[g];'
        + 'i=f+_r.p(g);'
        + 'if(_r.o(h,b,i)){'
        + '_r.s(h.foo,b,i+"/foo");'
        + '_r.i(h.bar,b,i+"/bar");'
        + '}'
        + '}'
        + '}'
        + '}'
        + '}'
        + 'return b.errors;'
        + '};'
        + 'export{validateFoo};',
    );
  });

  test('compiles self-reference', () => {
    expect(compileValidators(parseJtdRoot('foo', {
      properties: {
        aaa: {
          type: JtdType.STRING,
        },
        bbb: {
          elements: {
            ref: 'foo',
          },
        },
      },
    }))).toBe(
        'const validateFoo:_r.Validator=(a,b,c)=>{'
        + 'let d,e,f;'
        + 'b=b||{};'
        + 'c=c||"";'
        + 'if(_r.o(a,b,c)){'
        + '_r.s(a.aaa,b,c+"/aaa");'
        + 'd=a.bbb;'
        + 'e=c+"/bbb";'
        + 'if(_r.a(d,b,e)){'
        + 'for(f=0;f<d.length;f++){'
        + 'validateFoo(d[f],b,e+f);'
        + '}'
        + '}'
        + '}'
        + 'return b.errors;'
        + '};'
        + 'export{validateFoo};',
    );
  });

  test('compiles runnable source code', () => {

    const src = 'import * as _r from "../main/jtd-dialect/runtime";'
        + compileValidators(parseJtdRoot('foo', {
          nullable: true,
          properties: {
            bar: {
              enum: ['AAA', 'BBB'],
            },
          },
        }), {typeGuardsRendered: true});

    const module = evalModule(src);

    expect(module.validateFoo(null)).toBeUndefined();

    expect(module.validateFoo({bar: 'AAA'})).toBeUndefined();

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
