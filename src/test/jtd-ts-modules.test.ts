import {compileJtdTsModules} from '../main/jtd-ts-modules';

describe('compileJtdTsModules', () => {

  test('compiles demo modules', () => {
    const modules = compileJtdTsModules({
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
      }
      ,
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
    }, {emitsValidators: true, emitsTypeNarrowing: true});

    expect(modules).toEqual({
      './account.ts':
          'import c from "jtdc/lib/checker/runtime";'
          + 'import v,{Validator} from "jtdc/lib/validator/runtime";'
          + 'import {IUser,validateUser} from "./user.ts";'

          + 'export interface IAccount{'
          + 'user:IUser;'
          + 'stats:{'
          + 'visitCount:number;'
          + '};'
          + '\n'
          + '/**\n'
          + ' * Default role is guest\n'
          + ' */'
          + '\n'
          + 'roles?:Array<Role>;'
          + '}'

          + 'enum Role{ADMIN="admin",GUEST="guest",}'
          + 'export{Role};'

          + 'const validateAccount:Validator=(value,ctx,pointer)=>{'
          + 'ctx||={};'
          + 'pointer||="";'
          + 'let a,b;'
          + 'if(c.o(value,ctx,pointer)){'
          + 'validateUser(value.user,ctx,pointer+"/user");'
          + 'a=value.stats;'
          + 'b=pointer+"/stats";'
          + 'if(c.o(a,ctx,b)){'
          + 'c.i(a.visitCount,ctx,b+"/visitCount");'
          + '}'
          + 'a=value.roles;'
          + 'b=pointer+"/roles";'
          + 'if(a!==undefined){'
          + 'if(c.a(a,ctx,b)){'
          + 'for(let d=0;d<a.length;d++){'
          + 'validateRole(a[d],ctx,b+"/"+d);'
          + '}'
          + '}'
          + '}'
          + '}'
          + 'return ctx.errors;'
          + '};'

          + 'const isAccount=(value:unknown):value is IAccount=>!validateAccount(value,{lazy:true});'

          + 'const validateRole:Validator=(value,ctx,pointer)=>{'
          + 'ctx||={};'
          + 'pointer||="";'
          + 'let a=validateRole.c||={};'
          + 'c.e(value,a.b||=["admin","guest"],ctx,pointer);'
          + 'return ctx.errors;'
          + '};'

          + 'const isRole=(value:unknown):value is Role=>!validateRole(value,{lazy:true});'

          + 'export{validateAccount,isAccount,validateRole,isRole};',

      './user.ts':
          'import c from "jtdc/lib/checker/runtime";'
          + 'import v,{Validator} from "jtdc/lib/validator/runtime";'

          + 'export interface IUser{email:string;friends:Array<IUser>;'
          + 'name?:string;'
          + 'age?:number;'
          + '}'

          + 'const validateUser:Validator=(value,ctx,pointer)=>{'
          + 'ctx||={};'
          + 'pointer||="";'
          + 'let b,d;'
          + 'if(c.o(value,ctx,pointer)){'
          + 'c.s(value.email,ctx,pointer+"/email");'
          + 'b=value.friends;'
          + 'd=pointer+"/friends";'
          + 'if(c.a(b,ctx,d)){'
          + 'for(let a=0;a<b.length;a++){'
          + 'validateUser(b[a],ctx,d+"/"+a);'
          + '}'
          + '}'
          + 'b=value.name;'
          + 'd=pointer+"/name";'
          + 'if(b!==undefined){'
          + 'c.s(b,ctx,d);'
          + '}'
          + 'b=value.age;'
          + 'd=pointer+"/age";'
          + 'if(b!==undefined){'
          + 'c.i(b,ctx,d);'
          + '}'
          + '}'
          + 'return ctx.errors;'
          + '};'

          + 'const isUser=(value:unknown):value is IUser=>!validateUser(value,{lazy:true});'

          + 'export{validateUser,isUser};',
    });
  });
});
