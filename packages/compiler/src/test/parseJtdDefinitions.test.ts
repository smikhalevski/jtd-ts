import {IJtdNodeDict, JtdNodeType, JtdType} from '@jtdc/types';
import {parseJtdDefinitions} from '../main/parseJtdDefinitions';

describe('parseJtdDefinitions', () => {

  test('parses definitions', () => {
    const nodeMap = parseJtdDefinitions({
      foo: {type: JtdType.STRING},
      bar: {ref: 'foo'},
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
        jtd: {ref: 'foo'},
      },
    };

    expect(nodeMap).toEqual(result);
  });
});
