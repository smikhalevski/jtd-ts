import {compileDependentJtdTsModules, compileValidatorModule, JtdType} from '../main';

describe('compileValidatorModule', () => {

  test('compiles validators', () => {
    const result = compileValidatorModule({
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
      bar: {
        enum: ['AAA', 'BBB'],
      },
    }, {emitsCheckers: true});

    expect(result.source).toBe(
        'import $validatorRuntime from "jtd-ts/lib/validator/runtime";' +
        'type $Validator=$validatorRuntime.Validator;' +

        'const {$enum,$array,$object,$string,$number,$integer,$boolean,$raise,$pointer}=$validatorRuntime;' +
        'const $validatorCache:Record<string,any>={};' +

        'export const validateFoo:$Validator=(value,errors=[],pointer="")=>{' +
        'if($object(value,errors,pointer)){' +
        '$integer(value.aaa,errors,pointer+"/aaa");' +
        'validateBar(value.bbb,errors,pointer+"/bbb");' +
        '}' +
        'return errors;' +
        '};' +

        'export const isFoo=(value:unknown):value is any=>validateFoo(value).length===0;' +

        'export const validateBar:$Validator=(value,errors=[],pointer="")=>{' +
        '$enum(value,$validatorCache["bar.a"]||=new Set(["AAA","BBB"]),errors,pointer);' +
        'return errors;' +
        '};' +

        'export const isBar=(value:unknown):value is any=>validateBar(value).length===0;',
    );
  });
});

describe('compileDependentJtdTsModules', () => {

  test('compiles dependent modules', () => {
    const modules = compileDependentJtdTsModules({
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
    }, {emitsCheckers: true});

    expect(modules).toEqual({
      './bar-validators.ts':
          'import {Bar} from "./bar.ts";' +
          'import $validatorRuntime from "jtd-ts/lib/validator/runtime";' +

          'type $Validator=$validatorRuntime.Validator;' +
          'const {$enum,$array,$object,$string,$number,$integer,$boolean,$raise,$pointer}=$validatorRuntime;' +
          'const $validatorCache:Record<string,any>={};' +

          'export const validateBar:$Validator=(value,errors=[],pointer="")=>{' +
          '$enum(value,$validatorCache["bar.a"]||=new Set(["AAA","BBB"]),errors,pointer);' +
          'return errors;' +
          '};' +

          'export const isBar=(value:unknown):value is Bar=>validateBar(value).length===0;',

      './bar.ts': 'export enum Bar{AAA="AAA";BBB="BBB";}',

      './foo-validators.ts':
          'import {IFoo} from "./foo.ts";' +
          'import $validatorRuntime from "jtd-ts/lib/validator/runtime";' +

          'type $Validator=$validatorRuntime.Validator;' +
          'const {$enum,$array,$object,$string,$number,$integer,$boolean,$raise,$pointer}=$validatorRuntime;' +
          'const $validatorCache:Record<string,any>={};' +
          'export const validateFoo:$Validator=(value,errors=[],pointer="")=>{' +
          'if($object(value,errors,pointer)){' +
          '$integer(value.aaa,errors,pointer+"/aaa");' +
          'validateBar(value.bbb,errors,pointer+"/bbb");' +
          '}' +
          'return errors;' +
          '};' +

          'export const isFoo=(value:unknown):value is IFoo=>validateFoo(value).length===0;',

      './foo.ts':
          'import {Bar} from "./bar.ts";' +
          'export interface IFoo{aaa:number;bbb:Bar;}',
    });
  });
});
