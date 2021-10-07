import {compileModules} from '../main/modules-compiler';
import {validatorDialectFactory} from '@jtdc/jtd-dialect';
import {nodeImportResolver} from '../main/node-module-utils';

describe('compileJtdTsModules', () => {

  test('compiles demo modules', () => {
    const modules = compileModules({
      '/src/account.ts': {
        account: {
          properties: {
            user: {
              ref: './user#user',
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
                comment: 'The default role is guest',
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
      '/src/user.ts': {
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
    }, {
      importResolver: nodeImportResolver,
      validatorDialectFactory,
      validatorsRendered: true,
      typeGuardsRendered: true,
    });

    expect(modules).toEqual([
      {
        definitions: expect.any(Object),
        exports: {
          account: {
            typeGuardName: 'isAccount',
            typeName: 'Account',
            validatorName: 'validateAccount',
          },
          role: {
            typeGuardName: 'isRole',
            typeName: 'Role',
            validatorName: 'validateRole',
          },
        },
        path: '/src/account.ts',
        source: 'import*as runtime from"@jtdc/jtd-dialect/lib/runtime";import{User,validateUser}from"./user";export interface Account{user:User;stats:{visitCount:number;};/**\n * The default role is guest\n */roles?:Array<Role>;}enum Role{ADMIN="admin",GUEST="guest",}export{Role};const validateAccount:runtime.Validator=(a,b,c)=>{let d,e,f,g,h;b=b||{};c=c||"";if(runtime.checkObject(a,b,c)){validateUser(a.user,b,c+"/user");d=a.stats;e=c+"/stats";if(runtime.checkObject(d,b,e)){runtime.checkInteger(d.visitCount,b,e+"/visitCount");}f=a.roles;if(runtime.isDefined(f)){g=c+"/roles";if(runtime.checkArray(f,b,g)){for(h=0;h<f.length;h++){validateRole(f[h],b,g+runtime.JSON_POINTER_SEPARATOR+h);}}}}return b.errors;};export{validateAccount};const isAccount=(value:unknown):value is Account=>!validateAccount(value,{shallow:true});export{isAccount};const validateRole:runtime.Validator=(a,b,c)=>{b=b||{};runtime.checkEnum(a,(validateRole.cache||={}).a||=["admin","guest"],b,c||"");return b.errors;};export{validateRole};const isRole=(value:unknown):value is Role=>!validateRole(value,{shallow:true});export{isRole};',
      },
      {
        definitions: expect.any(Object),
        exports: {
          user: {
            typeGuardName: 'isUser',
            typeName: 'User',
            validatorName: 'validateUser',
          },
        },
        path: '/src/user.ts',
        source: 'import*as runtime from"@jtdc/jtd-dialect/lib/runtime";export interface User{email:string;friends:Array<User>;name?:string;age?:number;}const validateUser:runtime.Validator=(a,b,c)=>{let d,e,f,g,h;b=b||{};c=c||"";if(runtime.checkObject(a,b,c)){runtime.checkString(a.email,b,c+"/email");d=a.friends;e=c+"/friends";if(runtime.checkArray(d,b,e)){for(f=0;f<d.length;f++){validateUser(d[f],b,e+runtime.JSON_POINTER_SEPARATOR+f);}}g=a.name;if(runtime.isDefined(g)){runtime.checkString(g,b,c+"/name");}h=a.age;if(runtime.isDefined(h)){runtime.checkInteger(h,b,c+"/age");}}return b.errors;};export{validateUser};const isUser=(value:unknown):value is User=>!validateUser(value,{shallow:true});export{isUser};',
      },
    ]);
  });
});
