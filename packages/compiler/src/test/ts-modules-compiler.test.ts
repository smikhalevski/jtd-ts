import {compileTsModules} from '../main/ts-modules-compiler';
import {dialectFactory} from '@jtdc/jtd-dialect';

describe('compileJtdTsModules', () => {

  test('compiles demo modules', () => {
    const modules = compileTsModules({
      './account': {
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
      './user': {
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
    }, dialectFactory, {validatorsRendered: true, typeGuardsRendered: true});

    expect(modules).toEqual({
      './account': {
        source: 'import{_S,_P,_K,_R,_o,_a,_e,_b,_s,_n,_i,_N,_O,Validator as _Validator}from"@jtdc/jtd-dialect/lib/runtime";import{User,validateUser}from"./user";export interface Account{user:User;stats:{visitCount:number;};/**\n * The default role is guest\n */roles?:Array<Role>;}enum Role{ADMIN="admin",GUEST="guest",}export{Role};const validateAccount:_Validator=(a,b,c)=>{let d,e,f,g,h;b=b||{};c=c||"";if(_o(a,b,c)){validateUser(a.user,b,c+"/user");d=a.stats;e=c+"/stats";if(_o(d,b,e)){_i(d.visitCount,b,e+"/visitCount");}f=a.roles;if(_O(f)){g=c+"/roles";if(_a(f,b,g)){for(h=0;h<f.length;h++){validateRole(f[h],b,g+_S+h);}}}}return b.errors;};export{validateAccount};const isAccount=(value:unknown):value is Account=>!validateAccount(value,{shallow:true});export{isAccount};const validateRole:_Validator=(a,b,c)=>{b=b||{};_e(a,(validateRole.cache||={}).a||=["admin","guest"],b,c||"");return b.errors;};export{validateRole};const isRole=(value:unknown):value is Role=>!validateRole(value,{shallow:true});export{isRole};',
        definitions: expect.any(Object),
        exports: {
          account: 'Account',
          role: 'Role',
        },
        imports: {
          './user': ['user'],
        },
      },
      './user': {
        source: 'import{_S,_P,_K,_R,_o,_a,_e,_b,_s,_n,_i,_N,_O,Validator as _Validator}from"@jtdc/jtd-dialect/lib/runtime";export interface User{email:string;friends:Array<User>;name?:string;age?:number;}const validateUser:_Validator=(a,b,c)=>{let d,e,f,g,h;b=b||{};c=c||"";if(_o(a,b,c)){_s(a.email,b,c+"/email");d=a.friends;e=c+"/friends";if(_a(d,b,e)){for(f=0;f<d.length;f++){validateUser(d[f],b,e+_S+f);}}g=a.name;if(_O(g)){_s(g,b,c+"/name");}h=a.age;if(_O(h)){_i(h,b,c+"/age");}}return b.errors;};export{validateUser};const isUser=(value:unknown):value is User=>!validateUser(value,{shallow:true});export{isUser};',
        definitions: expect.any(Object),
        exports: {
          user: 'User',
        },
        imports: {},
      },
    });
  });
});
