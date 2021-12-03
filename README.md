# JTDc

[JSON Type Definition (RFC8927)](https://jsontypedef.com/) to TypeScript compiler.

- Compile enums, interface and types;
- Modify naming of enums, enum keys and values, interfaces, types, properties and any other rendered entities;
- Compile validator functions that produce an array of detected validation errors;
- Validators support recursive structures and shallow checks;
- Compile [type narrowing functions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html) aka type guards;
- Create custom validator dialect and have explicit control over every aspect of code generation;
- CLI and programmatic usage;

[Full API documentation.](https://smikhalevski.github.io/jtdc/)

```shell
npm install --save-dev @jtdc/cli
```

By default, validators and type guards use a `@jtdc/jtd-dialect` runtime dependency. You can alter validator compiler
dialect by providing `validatorDialectFactory` option to the compiler.

```shell
npm install --save-prod @jtdc/jtd-dialect
```

## CLI usage

Let's assume you have user and account type definitions in separate files under `./src` folder:

<details>
<summary><code>./src/user.json</code></summary>
<p>

```json
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

</p>
</details>

<details>
<summary><code>./src/account.json</code></summary>
<p>

```json
{
  "account": {
    "properties": {
      "user": {"ref": "./user.json#user"},
      "stats": {
        "properties": {
          "visitCount": {"type": "int32"}
        }
      }
    },
    "optionalProperties": {
      "roles": {
        "metadata": {
          "comment": "The default role is guest"
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

</p>
</details>

To compile these definitions to TypeScript use this command:

```sh
npx jtdc --package @jtdc/cli --rootDir ./src --includes '*.json' --outDir ./src/gen --typeGuards
```

The result would be output to `./src/gen` folder:

<details>
<summary><code>./src/gen/user.ts</code></summary>
<p>

```ts
import * as runtime from '@jtdc/jtd-dialect/lib/runtime';

export interface User {
  email: string;
  friends: Array<User>;
  name?: string;
  age?: number;
}

export let validateUser: runtime.Validator = (a, b, c) => {
  let d, e, f, g, h;
  b = b || {};
  c = c || '';
  if (runtime.checkObject(a, b, c)) {
    runtime.checkString(a.email, b, c + '/email');
    d = a.friends;
    e = c + '/friends';
    if (runtime.checkArray(d, b, e)) {
      for (f = 0; f < d.length; f++) {
        validateUser(d[f], b, e + runtime.JSON_POINTER_SEPARATOR + f);
      }
    }
    g = a.name;
    if (runtime.isDefined(g)) {
      runtime.checkString(g, b, c + '/name');
    }
    h = a.age;
    if (runtime.isDefined(h)) {
      runtime.checkInteger(h, b, c + '/age');
    }
  }
  return b.errors;
};

export let isUser = (value: unknown): value is User => !validateUser(value, {shallow: true});
```

</p>
</details>

<details>
<summary><code>./src/gen/account.ts</code></summary>
<p>

```ts
import * as runtime from '@jtdc/jtd-dialect/lib/runtime';
import {User, validateUser} from './user';

export interface Account {
  user: User;
  stats: { visitCount: number; };
  
  /**
   * The default role is guest
   */
  roles?: Array<Role>;
}

export enum Role {
  ADMIN = 'admin',
  GUEST = 'guest',
}

export let validateAccount: runtime.Validator = (a, b, c) => {
  let d, e, f, g, h;
  b = b || {};
  c = c || '';
  if (runtime.checkObject(a, b, c)) {
    validateUser(a.user, b, c + '/user');
    d = a.stats;
    e = c + '/stats';
    if (runtime.checkObject(d, b, e)) {
      runtime.checkInteger(d.visitCount, b, e + '/visitCount');
    }
    f = a.roles;
    if (runtime.isDefined(f)) {
      g = c + '/roles';
      if (runtime.checkArray(f, b, g)) {
        for (h = 0; h < f.length; h++) {
          validateRole(f[h], b, g + runtime.JSON_POINTER_SEPARATOR + h);
        }
      }
    }
  }
  return b.errors;
};

export let isAccount = (value: unknown): value is Account => !validateAccount(value, {shallow: true});

export let validateRole: runtime.Validator = (a, b, c) => {
  b = b || {};
  runtime.checkEnum(a, (validateRole.cache ||= {}).a ||= ['admin', 'guest'], b, c || '');
  return b.errors;
};

export let isRole = (value: unknown): value is Role => !validateRole(value, {shallow: true});
```

</p>
</details>

You can find [the source code of this example here](./example).

## Programmatic usage

[Full API documentation.](https://smikhalevski.github.io/jtdc/)

```ts
import {compileModule} from '@jtdc/compiler';
import userJson from './src/user.json';
import accountJson from './src/account.json';

compileModule({
  './user': userJson,
  './account': accountJson,
});
// → {'./user': 'import …', './account': 'import …'}
```
