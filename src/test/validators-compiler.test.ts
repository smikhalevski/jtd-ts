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
    expect(compileValidators(parseJtdRoot('foo', {type: JtdType.STRING}), {typeGuardsRendered: true})).toBe('const validateFoo:_Validator=(a,b,c)=>{b=b||{};_s(a,b,c||"");return b.errors;};export{validateFoo};const isFoo=(value:unknown):value is Foo=>!validateFoo(value,{shallow:true});export{isFoo};');
  });

  test('compiles nullable checker', () => {
    expect(compileValidators(parseJtdRoot('foo', {
      type: JtdType.STRING,
      nullable: true,
    }))).toBe('const validateFoo:_Validator=(a,b,c)=>{b=b||{};if(_N(a)){_s(a,b,c||"");}return b.errors;};export{validateFoo};');
  });

  test('compiles nullable any checker', () => {
    expect(compileValidators(parseJtdRoot('foo', {nullable: true}))).toBe('const validateFoo:_Validator=(a,b,c)=>{b=b||{};return b.errors;};export{validateFoo};');
  });

  test('compiles reference checker', () => {
    expect(compileValidators(parseJtdRoot('foo', {ref: 'bar'}))).toBe('const validateFoo:_Validator=(a,b,c)=>{b=b||{};validateBar(a,b,c||"");return b.errors;};export{validateFoo};');
  });

  test('compiles enum checker', () => {
    expect(compileValidators(parseJtdRoot('foo', {enum: ['AAA', 'BBB']}))).toBe('const validateFoo:_Validator=(a,b,c)=>{b=b||{};_e(a,(validateFoo.cache||={}).a||=["AAA","BBB"],b,c||"");return b.errors;};export{validateFoo};');
  });

  test('compiles elements checker', () => {
    expect(compileValidators(parseJtdRoot('foo', {elements: {type: JtdType.STRING}}))).toBe('const validateFoo:_Validator=(a,b,c)=>{let d;b=b||{};c=c||"";if(_a(a,b,c)){for(d=0;d<a.length;d++){_s(a[d],b,c+_S+d);}}return b.errors;};export{validateFoo};');
  });

  test('compiles any elements checker', () => {
    expect(compileValidators(parseJtdRoot('foo', {elements: {}}))).toBe('const validateFoo:_Validator=(a,b,c)=>{b=b||{};_a(a,b,c||"");return b.errors;};export{validateFoo};');
  });

  test('compiles values checker', () => {
    expect(compileValidators(parseJtdRoot('foo', {values: {type: JtdType.STRING}}))).toBe('const validateFoo:_Validator=(a,b,c)=>{let d,e;b=b||{};c=c||"";if(_o(a,b,c)){for(d=0,e=_K(a);d<e.length;d++){_s(a[e[d]],b,c+_P(e[d]));}}return b.errors;};export{validateFoo};');
  });

  test('compiles any values checker', () => {
    expect(compileValidators(parseJtdRoot('foo', {values: {}}))).toBe('const validateFoo:_Validator=(a,b,c)=>{b=b||{};_o(a,b,c||"");return b.errors;};export{validateFoo};');
  });

  test('compiles object properties checker', () => {
    expect(compileValidators(parseJtdRoot('foo', {
      properties: {
        foo: {type: JtdType.STRING},
      },
      optionalProperties: {
        bar: {type: JtdType.FLOAT32},
      },
    }))).toBe('const validateFoo:_Validator=(a,b,c)=>{let d;b=b||{};c=c||"";if(_o(a,b,c)){_s(a.foo,b,c+"/foo");d=a.bar;if(_O(d)){_n(d,b,c+"/bar");}}return b.errors;};export{validateFoo};');
  });

  test('compiles multiple optional properties', () => {
    expect(compileValidators(parseJtdRoot('foo', {
      optionalProperties: {
        foo: {type: JtdType.STRING},
        bar: {type: JtdType.FLOAT32},
      },
    }))).toBe('const validateFoo:_Validator=(a,b,c)=>{let d,e;b=b||{};c=c||"";if(_o(a,b,c)){d=a.foo;if(_O(d)){_s(d,b,c+"/foo");}e=a.bar;if(_O(e)){_n(e,b,c+"/bar");}}return b.errors;};export{validateFoo};');
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
    }))).toBe('const validateFoo:_Validator=(a,b,c)=>{b=b||{};c=c||"";if(_o(a,b,c)){switch(a.type){case "AAA":_s(a.foo,b,c+"/foo");break;case "BBB":_i(a.bar,b,c+"/bar");break;}_R(b,c+"/type")}return b.errors;};export{validateFoo};');
  });

  test('compiles multiple validators', () => {
    expect(compileValidators(parseJtdRoot('foo', {
      definitions: {
        bar: {type: JtdType.STRING},
      },
      ref: 'bar',
    }))).toBe('const validateBar:_Validator=(a,b,c)=>{b=b||{};_s(a,b,c||"");return b.errors;};export{validateBar};const validateFoo:_Validator=(a,b,c)=>{b=b||{};validateBar(a,b,c||"");return b.errors;};export{validateFoo};');
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
    }))).toBe('const validateFoo:_Validator=(a,b,c)=>{let d,e;b=b||{};c=c||"";if(_o(a,b,c)){d=a.aaa;e=c+"/aaa";if(_o(d,b,e)){_s(d.bbb,b,e+"/bbb");}}return b.errors;};export{validateFoo};');
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
    }))).toBe('const validateFoo:_Validator=(a,b,c)=>{let d,e,f,g,h,i,j;b=b||{};c=c||"";if(_a(a,b,c)){for(d=0;d<a.length;d++){e=a[d];f=c+_S+d;if(_o(e,b,f)){for(g=0,h=_K(e);g<h.length;g++){i=e[h[g]];j=f+_P(h[g]);if(_o(i,b,j)){_s(i.foo,b,j+"/foo");_i(i.bar,b,j+"/bar");}}}}}return b.errors;};export{validateFoo};');
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
    }))).toBe('const validateFoo:_Validator=(a,b,c)=>{let d,e,f;b=b||{};c=c||"";if(_o(a,b,c)){_s(a.aaa,b,c+"/aaa");d=a.bbb;e=c+"/bbb";if(_a(d,b,e)){for(f=0;f<d.length;f++){validateFoo(d[f],b,e+_S+f);}}}return b.errors;};export{validateFoo};');
  });

  test('compiles runnable source code', () => {

    const src = 'import {_S,_P,_K,_R,_o,_a,_e,_b,_s,_n,_i,_N,_O,Validator as _Validator} from "../main/jtd-dialect/runtime";'
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
