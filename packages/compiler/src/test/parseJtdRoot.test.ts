import {IJtdNodeDict, JtdNodeType, JtdType} from '@jtdc/types';
import {parseJtdRoot} from '../main/parseJtdRoot';

describe('parseJtdRoot', () => {

  test('parses JTD with definitions', () => {
    const nodeMap = parseJtdRoot('bar', {
      definitions: {
        foo: {type: JtdType.STRING},
      },
      ref: 'foo',
    });

    const result: IJtdNodeDict<any> = {
      foo: {
        nodeType: JtdNodeType.TYPE,
        type: JtdType.STRING,
        parentNode: null,
        jtd: {type: JtdType.STRING},
      },
      bar: {
        nodeType: JtdNodeType.REF,
        ref: 'foo',
        parentNode: null,
        jtd: {
          definitions: {
            foo: {type: JtdType.STRING},
          },
          ref: 'foo',
        },
      },
    };

    expect(nodeMap).toEqual(result);
  });
});
