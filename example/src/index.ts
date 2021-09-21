import {validateUser} from './gen/user';

console.log(validateUser({
  name: 'Foo',
  age: 50,
  email: 'foo@yahoo.com',
  friends: [
    {
      name: 'Bar',
    },
  ],
}));
