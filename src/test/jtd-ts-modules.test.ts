import {compileTsModules} from '../main/ts-modules-compiler';

describe('compileJtdTsModules', () => {

  test('compiles demo modules', () => {
    const modules = compileTsModules({
      './account.ts': {
        account: {
          properties: {
            user: {
              ref: 'user',
            },
            stats: {
              properties: {
                visitCount: {
                  type: 'int32',
                },
              },
            },
          },
          optionalProperties: {
            roles: {
              metadata: {
                comment: 'Default role is guest',
              },
              elements: {
                ref: 'role',
              },
            },
          },
        },
        role: {
          enum: ['admin', 'guest'],
        },
      },
      './user.ts': {
        user: {
          properties: {
            email: {
              type: 'string',
            },
            friends: {
              elements: {
                ref: 'user',
              },
            },
          },
          optionalProperties: {
            name: {
              type: 'string',
            },
            age: {
              type: 'int8',
            },
          },
        },
      },
    }, {validatorsRendered: true, typeGuardsRendered: true});

    expect(modules).toEqual({
      './account.ts':
          'import*as _r from"jtdc/lib/jtd-dialect/runtime";'
          + 'import{User,validateUser}from"./user.ts";'
          + 'export interface Account{'
          + 'user:User;'
          + 'stats:{visitCount:number;};'
          + '/**\n * Default role is guest\n */'
          + 'roles?:Array<Role>;'
          + '}'
          + 'enum Role{ADMIN="admin",GUEST="guest",}'
          + 'export{Role};'
          + 'const validateAccount:_r.Validator=(a,b,c)=>{'
          + 'let d,e,f,g,h;'
          + 'b=b||{};'
          + 'c=c||"";'
          + 'if(_r.o(a,b,c)){'
          + 'validateUser(a.user,b,c+"/user");'
          + 'd=a.stats;'
          + 'e=c+"/stats";'
          + 'if(_r.o(d,b,e)){'
          + '_r.i(d.visitCount,b,e+"/visitCount");'
          + '}'
          + 'f=a.roles;'
          + 'if(f!==undefined){'
          + 'g=c+"/roles";'
          + 'if(_r.a(f,b,g)){'
          + 'for(h=0;h<f.length;h++){'
          + 'validateRole(f[h],b,g+h);'
          + '}'
          + '}'
          + '}'
          + '}'
          + 'return b.errors;'
          + '};'
          + 'export{validateAccount};'
          + 'const isAccount=(value:unknown):value is Account=>!validateAccount(value,{shallow:true});'
          + 'export{isAccount};'
          + 'const validateRole:_r.Validator=(a,b,c)=>{'
          + 'b=b||{};'
          + '_r.e(a,(validateRole.cache||={}).a||=["admin","guest"],b,c||"");'
          + 'return b.errors;'
          + '};'
          + 'export{validateRole};'
          + 'const isRole=(value:unknown):value is Role=>!validateRole(value,{shallow:true});'
          + 'export{isRole};',

      './user.ts':
          'import*as _r from"jtdc/lib/jtd-dialect/runtime";'
          + 'export interface User{'
          + 'email:string;'
          + 'friends:Array<User>;'
          + 'name?:string;'
          + 'age?:number;'
          + '}'
          + 'const validateUser:_r.Validator=(a,b,c)=>{'
          + 'let d,e,f,g,h;'
          + 'b=b||{};'
          + 'c=c||"";'
          + 'if(_r.o(a,b,c)){'
          + '_r.s(a.email,b,c+"/email");'
          + 'd=a.friends;'
          + 'e=c+"/friends";'
          + 'if(_r.a(d,b,e)){'
          + 'for(f=0;f<d.length;f++){'
          + 'validateUser(d[f],b,e+f);'
          + '}'
          + '}'
          + 'g=a.name;'
          + 'if(g!==undefined){'
          + '_r.s(g,b,c+"/name");'
          + '}'
          + 'h=a.age;'
          + 'if(h!==undefined){'
          + '_r.i(h,b,c+"/age");'
          + '}'
          + '}'
          + 'return b.errors;'
          + '};'
          + 'export{validateUser};'
          + 'const isUser=(value:unknown):value is User=>!validateUser(value,{shallow:true});'
          + 'export{isUser};',
    });
  });
});
