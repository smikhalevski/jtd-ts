import {ModuleKind, transpileModule} from 'typescript';
import {compileValidators, validatorDialectConfig} from '../main/validators-compiler';
import {parseJtdRoot} from '../main/jtd-ast';
import {JtdType} from '@jtdc/types';
import {createJtdValidatorDialect} from '@jtdc/jtd-dialect/src/main';

function evalModule(source: string): Record<string, any> {
  return eval(`
    (function (exports) {
      ${transpileModule(source, {compilerOptions: {module: ModuleKind.CommonJS}}).outputText}
      return exports;
    })({});
  `);
}

describe('compileValidators', () => {

  const validatorDialect = createJtdValidatorDialect(validatorDialectConfig);

  test('compiles string type validator', () => {
    expect(compileValidators(parseJtdRoot('foo', {type: JtdType.STRING}), validatorDialect, {typeGuardsRendered: true})).toBe('const validateFoo:runtime.Validator=(a,b,c)=>{b=b||{};runtime.checkString(a,b,c||"");return b.errors;};export{validateFoo};const isFoo=(value:unknown):value is Foo=>!validateFoo(value,{shallow:true});export{isFoo};');
  });

  test('compiles nullable checker', () => {
    expect(compileValidators(parseJtdRoot('foo', {
      type: JtdType.STRING,
      nullable: true,
    }), validatorDialect)).toBe('const validateFoo:runtime.Validator=(a,b,c)=>{b=b||{};if(runtime.isNotNull(a)){runtime.checkString(a,b,c||"");}return b.errors;};export{validateFoo};');
  });

  test('compiles nullable any checker', () => {
    expect(compileValidators(parseJtdRoot('foo', {nullable: true}), validatorDialect)).toBe('const validateFoo:runtime.Validator=(a,b,c)=>{b=b||{};return b.errors;};export{validateFoo};');
  });

  test('compiles reference checker', () => {
    expect(compileValidators(parseJtdRoot('foo', {ref: 'bar'}), validatorDialect)).toBe('const validateFoo:runtime.Validator=(a,b,c)=>{b=b||{};validateBar(a,b,c||"");return b.errors;};export{validateFoo};');
  });

  test('compiles enum checker', () => {
    expect(compileValidators(parseJtdRoot('foo', {enum: ['AAA', 'BBB']}), validatorDialect)).toBe('const validateFoo:runtime.Validator=(a,b,c)=>{b=b||{};runtime.checkEnum(a,(validateFoo.cache||={}).a||=["AAA","BBB"],b,c||"");return b.errors;};export{validateFoo};');
  });

  test('compiles elements checker', () => {
    expect(compileValidators(parseJtdRoot('foo', {elements: {type: JtdType.STRING}}), validatorDialect)).toBe('const validateFoo:runtime.Validator=(a,b,c)=>{let d;b=b||{};c=c||"";if(runtime.checkArray(a,b,c)){for(d=0;d<a.length;d++){runtime.checkString(a[d],b,c+runtime.JSON_POINTER_SEPARATOR+d);}}return b.errors;};export{validateFoo};');
  });

  test('compiles any elements checker', () => {
    expect(compileValidators(parseJtdRoot('foo', {elements: {}}), validatorDialect)).toBe('const validateFoo:runtime.Validator=(a,b,c)=>{b=b||{};runtime.checkArray(a,b,c||"");return b.errors;};export{validateFoo};');
  });

  test('compiles values checker', () => {
    expect(compileValidators(parseJtdRoot('foo', {values: {type: JtdType.STRING}}), validatorDialect)).toBe('const validateFoo:runtime.Validator=(a,b,c)=>{let d,e;b=b||{};c=c||"";if(runtime.checkObject(a,b,c)){for(d=0,e=runtime.getObjectKeys(a);d<e.length;d++){runtime.checkString(a[e[d]],b,c+runtime.toJsonPointer(e[d]));}}return b.errors;};export{validateFoo};');
  });

  test('compiles any values checker', () => {
    expect(compileValidators(parseJtdRoot('foo', {values: {}}), validatorDialect)).toBe('const validateFoo:runtime.Validator=(a,b,c)=>{b=b||{};runtime.checkObject(a,b,c||"");return b.errors;};export{validateFoo};');
  });

  test('compiles object properties checker', () => {
    expect(compileValidators(parseJtdRoot('foo', {
      properties: {
        foo: {type: JtdType.STRING},
      },
      optionalProperties: {
        bar: {type: JtdType.FLOAT32},
      },
    }), validatorDialect)).toBe('const validateFoo:runtime.Validator=(a,b,c)=>{let d;b=b||{};c=c||"";if(runtime.checkObject(a,b,c)){runtime.checkString(a.foo,b,c+"/foo");d=a.bar;if(runtime.isDefined(d)){runtime.checkNumber(d,b,c+"/bar");}}return b.errors;};export{validateFoo};');
  });

  test('compiles multiple optional properties', () => {
    expect(compileValidators(parseJtdRoot('foo', {
      optionalProperties: {
        foo: {type: JtdType.STRING},
        bar: {type: JtdType.FLOAT32},
      },
    }), validatorDialect)).toBe('const validateFoo:runtime.Validator=(a,b,c)=>{let d,e;b=b||{};c=c||"";if(runtime.checkObject(a,b,c)){d=a.foo;if(runtime.isDefined(d)){runtime.checkString(d,b,c+"/foo");}e=a.bar;if(runtime.isDefined(e)){runtime.checkNumber(e,b,c+"/bar");}}return b.errors;};export{validateFoo};');
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
    }), validatorDialect)).toBe('const validateFoo:runtime.Validator=(a,b,c)=>{b=b||{};c=c||"";if(runtime.checkObject(a,b,c)){switch(a.type){case "AAA":runtime.checkString(a.foo,b,c+"/foo");break;case "BBB":runtime.checkInteger(a.bar,b,c+"/bar");break;}runtime.raiseInvalid(b,c+"/type")}return b.errors;};export{validateFoo};');
  });

  test('compiles multiple validators', () => {
    expect(compileValidators(parseJtdRoot('foo', {
      definitions: {
        bar: {type: JtdType.STRING},
      },
      ref: 'bar',
    }), validatorDialect)).toBe('const validateBar:runtime.Validator=(a,b,c)=>{b=b||{};runtime.checkString(a,b,c||"");return b.errors;};export{validateBar};const validateFoo:runtime.Validator=(a,b,c)=>{b=b||{};validateBar(a,b,c||"");return b.errors;};export{validateFoo};');
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
    }), validatorDialect)).toBe('const validateFoo:runtime.Validator=(a,b,c)=>{let d,e;b=b||{};c=c||"";if(runtime.checkObject(a,b,c)){d=a.aaa;e=c+"/aaa";if(runtime.checkObject(d,b,e)){runtime.checkString(d.bbb,b,e+"/bbb");}}return b.errors;};export{validateFoo};');
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
    }), validatorDialect)).toBe('const validateFoo:runtime.Validator=(a,b,c)=>{let d,e,f,g,h,i,j;b=b||{};c=c||"";if(runtime.checkArray(a,b,c)){for(d=0;d<a.length;d++){e=a[d];f=c+runtime.JSON_POINTER_SEPARATOR+d;if(runtime.checkObject(e,b,f)){for(g=0,h=runtime.getObjectKeys(e);g<h.length;g++){i=e[h[g]];j=f+runtime.toJsonPointer(h[g]);if(runtime.checkObject(i,b,j)){runtime.checkString(i.foo,b,j+"/foo");runtime.checkInteger(i.bar,b,j+"/bar");}}}}}return b.errors;};export{validateFoo};');
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
    }), validatorDialect)).toBe('const validateFoo:runtime.Validator=(a,b,c)=>{let d,e,f;b=b||{};c=c||"";if(runtime.checkObject(a,b,c)){runtime.checkString(a.aaa,b,c+"/aaa");d=a.bbb;e=c+"/bbb";if(runtime.checkArray(d,b,e)){for(f=0;f<d.length;f++){validateFoo(d[f],b,e+runtime.JSON_POINTER_SEPARATOR+f);}}}return b.errors;};export{validateFoo};');
  });

  test('compiles runnable source code', () => {

    const src = 'import * as runtime from "@jtdc/jtd-dialect/lib/runtime";'
        + compileValidators(parseJtdRoot('foo', {
          nullable: true,
          properties: {
            bar: {
              enum: ['AAA', 'BBB'],
            },
          },
        }), validatorDialect, {typeGuardsRendered: true});

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
