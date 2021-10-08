import {createImportResolver} from '../main/module-utils';
import * as path from 'path';
import {JtdNodeType} from '@jtdc/types/src/main';

describe('createImportResolver', () => {

  const importResolver = createImportResolver(path);

  test('throws on local references', () => {
    expect(() => importResolver(
        {
          nodeType: JtdNodeType.REF,
          ref: 'foo',
          jtd: {},
          parentNode: null,
        },
        './qux.json',
        [
          {
            definitions: {},
            filePath: './bar.json',
            source: '',
            exports: {
              foo: {
                typeName: '',
                validatorName: '',
                typeGuardName: '',
              },
            },
          },
        ],
    )).toThrow();
  });

  test('resolves with exports', () => {
    expect(importResolver(
        {
          nodeType: JtdNodeType.REF,
          ref: 'bar.json#foo',
          jtd: {},
          parentNode: null,
        },
        './qux.json',
        [
          {
            definitions: {},
            filePath: './bar.json',
            source: '',
            exports: {
              foo: {
                typeName: 'Foo',
                validatorName: 'validateFoo',
                typeGuardName: 'isFoo',
              },
            },
          },
        ],
    )).toEqual([
      {
        typeName: 'Foo',
        validatorName: 'validateFoo',
        typeGuardName: 'isFoo',
      },
      './bar',
    ]);
  });
});
