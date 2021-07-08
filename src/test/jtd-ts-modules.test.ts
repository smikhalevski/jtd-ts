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
    }, {emitsValidators: true, emitsTypeNarrowing: true});

    expect(modules).toEqual({
      './bar.ts':
          'import c from "jtdc/lib/checker/runtime";' +
          'import v from "jtdc/lib/validator/runtime";' +

          'enum Bar{AAA="AAA",BBB="BBB",}' +
          'export{Bar};' +

          'const validateBar:v.Validator=(value,ctx,pointer)=>{' +
          'ctx||={};' +
          'pointer||="";' +
          'let a=validateBar.c||={};' +
          'c.e(value,a.b||=["AAA","BBB"],ctx,pointer);' +
          'return ctx.errors;' +
          '};' +

          'const isBar=(value:unknown):value is Bar=>!validateBar(value,{lazy:true});' +

          'export{validateBar,isBar};',

      './foo.ts':
          'import c from "jtdc/lib/checker/runtime";' +
          'import v from "jtdc/lib/validator/runtime";' +

          'import {Bar,validateBar} from "./bar.ts";' +

          'export interface IFoo{aaa:number;bbb:Bar;}' +

          'const validateFoo:v.Validator=(value,ctx,pointer)=>{' +
          'ctx||={};' +
          'pointer||="";' +
          'if(c.o(value,ctx,pointer)){' +
          'c.i(value.aaa,ctx,pointer+"/aaa");' +
          'validateBar(value.bbb,ctx,pointer+"/bbb");' +
          '}' +
          'return ctx.errors;' +
          '};' +

          'const isFoo=(value:unknown):value is IFoo=>!validateFoo(value,{lazy:true});' +

          'export{validateFoo,isFoo};',
    });
  });
});
