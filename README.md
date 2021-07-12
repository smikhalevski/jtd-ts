# jtdc

JSON Type Definition to TypeScript compiler.

- Compiles enums, interface and types;
- Compiles validator functions that produce an array of detected validation errors;
- Compiles [type narrowing functions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html) aka type guards;
- You can modify naming of enums, enum keys and values, interfaces, types, properties and any other rendered entities;
- CLI and programmatic usage;

[Full API documentation.](https://smikhalevski.github.io/jtdc/)

```shell
npm install --save-prod jtdc
```

## CLI usage

Let's assume you have user and account type definitions in separate files:

```json5
// ./user.json

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

```json5
// ./account.json

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

To compile these definitions to TypeScript use this command:

```sh
npx jtdc --rootDir . --includes '*.json' --outDir ./gen --typeGuards
```

The result would be output to `./gen` folder.

Compiled files would look like this (manually formatted):

```ts
// ./gen/user.ts

import * as _r from 'jtdc/lib/jtd-dialect/runtime';

export interface User {
  email: string;
  friends: Array<User>;
  name?: string;
  age?: number;
}

const validateUser: _r.Validator = (a, b, c) => {
  let d, e, f, g, h;
  b = b || {};
  c = c || '';
  if (_r.o(a, b, c)) {
    _r.s(a.email, b, c + '/email');
    d = a.friends;
    e = c + '/friends';
    if (_r.a(d, b, e)) {
      for (f = 0; f < d.length; f++) {
        validateUser(d[f], b, e + f);
      }
    }
    g = a.name;
    if (g !== undefined) {
      _r.s(g, b, c + '/name');
    }
    h = a.age;
    if (h !== undefined) {
      _r.i(h, b, c + '/age');
    }
  }
  return b.errors;
};
export {validateUser};

const isUser = (value: unknown): value is User => !validateUser(value, {shallow: true});
export {isUser};
```

```ts
// ./gen/account.ts

import * as _r from 'jtdc/lib/jtd-dialect/runtime';
import {User, validateUser} from './user';

export interface Account {
  user: User;
  stats: {
    visitCount: number;
  };
  /**
   * Default role is guest
   */
  roles?: Array<Role>;
}

enum Role {
  ADMIN = 'admin',
  GUEST = 'guest',
}

export {Role};

const validateAccount: _r.Validator = (a, b, c) => {
  let d, e, f, g, h;
  b = b || {};
  c = c || '';
  if (_r.o(a, b, c)) {
    validateUser(a.user, b, c + '/user');
    d = a.stats;
    e = c + '/stats';
    if (_r.o(d, b, e)) {
      _r.i(d.visitCount, b, e + '/visitCount');
    }
    f = a.roles;
    if (f !== undefined) {
      g = c + '/roles';
      if (_r.a(f, b, g)) {
        for (h = 0; h < f.length; h++) {
          validateRole(f[h], b, g + h);
        }
      }
    }
  }
  return b.errors;
};
export {validateAccount};

const isAccount = (value: unknown): value is Account => !validateAccount(value, {shallow: true});
export {isAccount};

const validateRole: _r.Validator = (a, b, c) => {
  b = b || {};
  _r.e(a, (validateRole.cache ||= {}).a ||= ['admin', 'guest'], b, c || '');
  return b.errors;
};
export {validateRole};

const isRole = (value: unknown): value is Role => !validateRole(value, {shallow: true});
export {isRole};
```

## Programmatic usage

[Full API documentation.](https://smikhalevski.github.io/jtdc/)

```ts
import {compileTsModules} from 'jtdc';
import userJson from './src/user.json';
import accountJson from './src/account.json';

compileTsModules({
  './user': userJson,
  './account': accountJson,
});
// → {'./user': 'import …', './account': 'import …'}
```
