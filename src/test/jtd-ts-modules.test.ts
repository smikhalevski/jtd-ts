import {compileJtdTsModules} from '../main/jtd-ts-modules';
import {JtdType} from '../main/jtd-types';

describe('compileJtdTsModules', () => {

  test('compiles modules', () => {
    const modules = compileJtdTsModules({
      './foo.ts': {
        foo: {
          properties: {
            aaa: {
              type: JtdType.INT8,
            },
            bbb: {
              ref: 'bar',
            },
          },
        },
      },
      './bar.ts': {
        bar: {
          enum: ['AAA', 'BBB'],
        },
      },
    }, {emitsValidators: true, emitsCheckers: true});

    expect(modules).toEqual({
      './bar.ts':
          'import __validatorRuntime from "jtd-ts/lib/validator/runtime";' +

          'type __Validator=__validatorRuntime.Validator;' +

          'const {__enum,__array,__object,__string,__number,__integer,__boolean,__invalid,__pointer}=__validatorRuntime;' +
          'const __validatorCache:Record<string,any>={};' +

          'export enum Bar{AAA="AAA";BBB="BBB";}' +

          'export const validateBar:__Validator=(value,errors=[],pointer="")=>{' +
          '__enum(value,__validatorCache["bar.a"]||=new Set(["AAA","BBB"]),errors,pointer);' +
          'return errors;' +
          '};' +

          'export const isBar=(value:unknown):value is Bar=>validateBar(value).length===0;',

      './foo.ts':
          'import {Bar} from "./bar.ts";' +
          'import __validatorRuntime from "jtd-ts/lib/validator/runtime";' +

          'type __Validator=__validatorRuntime.Validator;' +

          'const {__enum,__array,__object,__string,__number,__integer,__boolean,__invalid,__pointer}=__validatorRuntime;' +
          'const __validatorCache:Record<string,any>={};' +

          'export interface IFoo{aaa:number;bbb:Bar;}' +

          'export const validateFoo:__Validator=(value,errors=[],pointer="")=>{' +
          'if(__object(value,errors,pointer)){' +
          '__integer(value.aaa,errors,pointer+"/aaa");' +
          'validateBar(value.bbb,errors,pointer+"/bbb");' +
          '}' +
          'return errors;' +
          '};' +

          'export const isFoo=(value:unknown):value is IFoo=>validateFoo(value).length===0;',
    });
  });
});
