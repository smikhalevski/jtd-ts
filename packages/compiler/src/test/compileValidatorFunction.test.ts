import {ModuleKind, transpileModule} from 'typescript';
import {JtdType} from '@jtdc/types';
import {validatorDialectFactory} from '@jtdc/jtd-dialect';
import {compileValidatorFunction, validatorDialectConfig} from '../main/compileValidatorFunction';
import {die} from '../main/misc';
import {parseJtd} from '../main/parseJtd';

function evalModule(source: string): Record<string, any> {
  return eval(`
    (function (exports) {
      ${transpileModule(source, {compilerOptions: {module: ModuleKind.CommonJS}}).outputText}
      return exports;
    })({});
  `);
}

describe('compileValidatorFunction', () => {

  const refResolver = () => die('Unresolved ref');
  const validatorDialect = validatorDialectFactory(validatorDialectConfig);

  test('compiles string type validator', () => {
    const src = compileValidatorFunction('foo', parseJtd({type: JtdType.STRING}), refResolver, validatorDialect);

    expect(src).toBe('export let validateFoo:runtime.Validator=(a,b,c)=>{b=b||{};runtime.checkString(a,b,c||"");return b.errors;};');
  });

  test('compiles nullable checker', () => {
    const src = compileValidatorFunction('foo', parseJtd({
      type: JtdType.STRING,
      nullable: true,
    }), refResolver, validatorDialect);

    expect(src).toBe('export let validateFoo:runtime.Validator=(a,b,c)=>{b=b||{};if(runtime.isNotNull(a)){runtime.checkString(a,b,c||"");}return b.errors;};');
  });

  test('compiles nullable any checker', () => {
    const src = compileValidatorFunction('foo', parseJtd({nullable: true}), refResolver, validatorDialect);

    expect(src).toBe('export let validateFoo:runtime.Validator=(a,b,c)=>{b=b||{};return b.errors;};');
  });

  test('compiles reference checker', () => {
    const src = compileValidatorFunction('foo', parseJtd({ref: 'bar'}), () => 'validateBar', validatorDialect);

    expect(src).toBe('export let validateFoo:runtime.Validator=(a,b,c)=>{b=b||{};validateBar(a,b,c||"");return b.errors;};');
  });

  test('compiles enum checker', () => {
    const src = compileValidatorFunction('foo', parseJtd({enum: ['AAA', 'BBB']}), refResolver, validatorDialect);

    expect(src).toBe('export let validateFoo:runtime.Validator=(a,b,c)=>{b=b||{};runtime.checkEnum(a,(validateFoo.cache||={}).a||=["AAA","BBB"],b,c||"");return b.errors;};');
  });

  test('compiles elements checker', () => {
    const src = compileValidatorFunction('foo', parseJtd({elements: {type: JtdType.STRING}}), refResolver, validatorDialect);

    expect(src).toBe('export let validateFoo:runtime.Validator=(a,b,c)=>{let d;b=b||{};c=c||"";if(runtime.checkArray(a,b,c)){for(d=0;d<a.length;d++){runtime.checkString(a[d],b,c+runtime.JSON_POINTER_SEPARATOR+d);}}return b.errors;};');
  });

  test('compiles any elements checker', () => {
    const src = compileValidatorFunction('foo', parseJtd({elements: {}}), refResolver, validatorDialect);

    expect(src).toBe('export let validateFoo:runtime.Validator=(a,b,c)=>{b=b||{};runtime.checkArray(a,b,c||"");return b.errors;};');
  });

  test('compiles values checker', () => {
    const src = compileValidatorFunction('foo', parseJtd({values: {type: JtdType.STRING}}), refResolver, validatorDialect);

    expect(src).toBe('export let validateFoo:runtime.Validator=(a,b,c)=>{let d,e;b=b||{};c=c||"";if(runtime.checkObject(a,b,c)){for(d=0,e=runtime.getObjectKeys(a);d<e.length;d++){runtime.checkString(a[e[d]],b,c+runtime.toJsonPointer(e[d]));}}return b.errors;};');
  });

  test('compiles any values checker', () => {
    const src = compileValidatorFunction('foo', parseJtd({values: {}}), refResolver, validatorDialect);

    expect(src).toBe('export let validateFoo:runtime.Validator=(a,b,c)=>{b=b||{};runtime.checkObject(a,b,c||"");return b.errors;};');
  });

  test('compiles object properties checker', () => {
    const src = compileValidatorFunction('foo', parseJtd({
      properties: {
        foo: {type: JtdType.STRING},
      },
      optionalProperties: {
        bar: {type: JtdType.FLOAT32},
      },
    }), refResolver, validatorDialect);

    expect(src).toBe('export let validateFoo:runtime.Validator=(a,b,c)=>{let d;b=b||{};c=c||"";if(runtime.checkObject(a,b,c)){runtime.checkString(a.foo,b,c+"/foo");d=a.bar;if(runtime.isDefined(d)){runtime.checkNumber(d,b,c+"/bar");}}return b.errors;};');
  });

  test('compiles multiple optional properties', () => {
    const src = compileValidatorFunction('foo', parseJtd({
      optionalProperties: {
        foo: {type: JtdType.STRING},
        bar: {type: JtdType.FLOAT32},
      },
    }), refResolver, validatorDialect);

    expect(src).toBe('export let validateFoo:runtime.Validator=(a,b,c)=>{let d,e;b=b||{};c=c||"";if(runtime.checkObject(a,b,c)){d=a.foo;if(runtime.isDefined(d)){runtime.checkString(d,b,c+"/foo");}e=a.bar;if(runtime.isDefined(e)){runtime.checkNumber(e,b,c+"/bar");}}return b.errors;};');
  });

  test('compiles discriminated union checker', () => {
    const src = compileValidatorFunction('foo', parseJtd({
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
    }), refResolver, validatorDialect);

    expect(src).toBe('export let validateFoo:runtime.Validator=(a,b,c)=>{b=b||{};c=c||"";if(runtime.checkObject(a,b,c)){switch(a.type){case "AAA":runtime.checkString(a.foo,b,c+"/foo");break;case "BBB":runtime.checkInteger(a.bar,b,c+"/bar");break;}runtime.raiseInvalid(b,c+"/type")}return b.errors;};');
  });

  test('compiles nested objects', () => {
    const src = compileValidatorFunction('foo', parseJtd({
      properties: {
        aaa: {
          properties: {
            bbb: {type: JtdType.STRING},
          },
        },
      },
    }), refResolver, validatorDialect);

    expect(src).toBe('export let validateFoo:runtime.Validator=(a,b,c)=>{let d,e;b=b||{};c=c||"";if(runtime.checkObject(a,b,c)){d=a.aaa;e=c+"/aaa";if(runtime.checkObject(d,b,e)){runtime.checkString(d.bbb,b,e+"/bbb");}}return b.errors;};');
  });

  test('compiles nested elements and values', () => {
    const src = compileValidatorFunction('foo', parseJtd({
      elements: {
        values: {
          properties: {
            foo: {type: JtdType.STRING},
            bar: {type: JtdType.INT16},
          },
        },
      },
    }), refResolver, validatorDialect);

    expect(src).toBe('export let validateFoo:runtime.Validator=(a,b,c)=>{let d,e,f,g,h,i,j;b=b||{};c=c||"";if(runtime.checkArray(a,b,c)){for(d=0;d<a.length;d++){e=a[d];f=c+runtime.JSON_POINTER_SEPARATOR+d;if(runtime.checkObject(e,b,f)){for(g=0,h=runtime.getObjectKeys(e);g<h.length;g++){i=e[h[g]];j=f+runtime.toJsonPointer(h[g]);if(runtime.checkObject(i,b,j)){runtime.checkString(i.foo,b,j+"/foo");runtime.checkInteger(i.bar,b,j+"/bar");}}}}}return b.errors;};');
  });

  test('compiles runnable source code', () => {

    const src = 'import * as runtime from "@jtdc/jtd-dialect/lib/runtime";'
        + compileValidatorFunction('foo', parseJtd({
          nullable: true,
          properties: {
            bar: {
              enum: ['AAA', 'BBB'],
            },
          },
        }), refResolver, validatorDialect);

    const module = evalModule(src);

    expect(module.validateFoo(null)).toBeUndefined();

    expect(module.validateFoo({bar: 'AAA'})).toBeUndefined();

    expect(module.validateFoo({})).toEqual([
      {pointer: '/bar', code: 'required'},
    ]);

    expect(module.validateFoo({bar: 'CCC'})).toEqual([
      {pointer: '/bar', code: 'invalid'},
    ]);
  });

});
