# jtdc

JSON Type Definition to TypeScript compiler.

- Compiles typings;
- Compiles validator functions;
- Compiles type narrowing functions;
- CLI and programmatic support;

```shell
npm install --save-prod jtdc 
```

## CLI usage

Let's assume you want to compile these files to TypeScript:

```json
// ./src/user.json
{
  "user": {
    "properties": {
      "email": {"type": "string"},
      "friends": {
        "elements": {"ref": "user"}
      }
    },
    "optionalProperties": {
      "name": {"type": "string"},
      "age": {"type": "int8"}
    }
  }
}
```

```json
// ./src/account.json
{
  "account": {
    "properties": {
      "user": {"ref": "user"},
      "stats": {
        "properties": {
          "visitCount": {"type": "int32"}
        }
      }
    },
    "optionalProperties": {
      "roles": {
        "metadata": {
          "comment": "Default role is guest"
        },
        "elements": {"ref": "role"}
      }
    }
  },
  "role": {
    "enum": ["admin", "guest"]
  }
}
```

Compile these type definitions to TypeScript:

```sh
jtdc --rootDir ./src --files ./src/*.json --outDir ./gen --validators --narrowing
```

The result would be emitted to `./gen` folder. The outputted files are presented below (formatted for convenience).

```ts
// ./gen/user.ts
import c from 'jtdc/lib/checker/runtime';
import {Validator} from 'jtdc/lib/validator/runtime';

export interface IUser {
  email: string;
  friends: Array<IUser>;
  name?: string;
  age?: number;
}

const validateUser: Validator = (value, ctx, pointer) => {
  ctx ||= {};
  pointer ||= '';
  let b, d;
  if (c.o(value, ctx, pointer)) {
    c.s(value.email, ctx, pointer + '/email');
    b = value.friends;
    d = pointer + '/friends';
    if (c.a(b, ctx, d)) {
      for (let a = 0; a < b.length; a++) {
        validateUser(b[a], ctx, d + '/' + a);
      }
    }
    b = value.name;
    d = pointer + '/name';
    if (b !== undefined) {
      c.s(b, ctx, d);
    }
    b = value.age;
    d = pointer + '/age';
    if (b !== undefined) {
      c.i(b, ctx, d);
    }
  }
  return ctx.errors;
};

const isUser = (value: unknown): value is IUser => !validateUser(value, {lazy: true});

export {validateUser, isUser};
```

```ts
// ./gen/account.ts
import c from 'jtdc/lib/checker/runtime';
import {Validator} from 'jtdc/lib/validator/runtime';
import {IUser, validateUser} from './user';

export interface IAccount {
  user: IUser;
  stats: { visitCount: number; };
  /**
   * Default role is guest
   */
  roles?: Array<Role>;
}

enum Role {ADMIN = 'admin', GUEST = 'guest',}

export {Role};

const validateAccount: Validator = (value, ctx, pointer) => {
  ctx ||= {};
  pointer ||= '';
  let a, b;
  if (c.o(value, ctx, pointer)) {
    validateUser(value.user, ctx, pointer + '/user');
    a = value.stats;
    b = pointer + '/stats';
    if (c.o(a, ctx, b)) {
      c.i(a.visitCount, ctx, b + '/visitCount');
    }
    a = value.roles;
    b = pointer + '/roles';
    if (a !== undefined) {
      if (c.a(a, ctx, b)) {
        for (let d = 0; d < a.length; d++) {
          validateRole(a[d], ctx, b + '/' + d);
        }
      }
    }
  }
  return ctx.errors;
};

const isAccount = (value: unknown): value is IAccount => !validateAccount(value, {lazy: true});

const validateRole: Validator = (value, ctx, pointer) => {
  ctx ||= {};
  pointer ||= '';
  let a = validateRole.c ||= {};
  c.e(value, a.b ||= ['admin', 'guest'], ctx, pointer);
  return ctx.errors;
};

const isRole = (value: unknown): value is Role => !validateRole(value, {lazy: true});

export {validateAccount, isAccount, validateRole, isRole};
```

## Programmatic usage

```ts
import {compileJtdTsModules} from 'jtdc';
import userJson from './src/user.json';
import accountJson from './src/account.json';

compileJtdTsModules({
  './user.ts': userJson,
  './account.ts': accountJson,
});
// → {'./user.ts': 'import …', './account.ts': 'import …'}
```
