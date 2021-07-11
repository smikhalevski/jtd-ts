import {compileValidators} from '../main/validator-compiler';
import {parseJtdRoot} from '../main/jtd-ast';

describe('compileValidators', () => {

  test('compiles string type validator', () => {
    expect(compileValidators(parseJtdRoot('foo', {type: 'string'}))).toBe(
        'import * as r from "jtdc/lib/jtd-dialect/runtime";' +
        'const validateFoo:Validator=(a,b,c)=>{' +
        'r.s(a,b||{},c||"");' +
        'return b.errors;' +
        '};' +
        'export{validateFoo};' +
        'const isFoo=(value:unknown):value is foo=>!validateFoo(value,{lazy:true});' +
        'export{isFoo};',
    );
  });

  test('compiles values checker', () => {
    expect(compileValidators(parseJtdRoot('foo', {values: {type: 'string'}}))).toBe(
        'import * as r from "jtdc/lib/jtd-dialect/runtime";' +
        'const validateFoo:Validator=(a,b,c)=>{' +
        'b=b||{};' +
        'c=c||"";' +
        'if(r.o(a,b,c)){' +
        'for(d in a){' +
        'r.s(a[d],b,c+r.p(d));' +
        '}' +
        '}' +
        'return b.errors;' +
        '};' +
        'export{validateFoo};' +

        'const isFoo=(value:unknown):value is foo=>!validateFoo(value,{lazy:true});' +
        'export{isFoo};',
    );
  });
});
