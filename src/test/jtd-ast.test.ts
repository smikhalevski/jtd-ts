import {JtdNode, JtdNodeType, JtdRootNode} from '../main/jtd-ast-types';
import {parseJtd, parseJtdDefinitions, parseJtdRoot} from '../main/jtd-ast';
import {JtdType} from '../main/jtd-types';

describe('parseJtdRoot', () => {

  test('parses JTD with definitions', () => {
    const nodeMap = parseJtdRoot('bar', {
      definitions: {
        foo: {type: JtdType.STRING},
      },
      ref: 'foo',
    });

    const result: Record<string, JtdRootNode<any>> = {
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

describe('parseJtdDefinitions', () => {

  test('parses definitions', () => {
    const nodeMap = parseJtdDefinitions({
      foo: {type: JtdType.STRING},
      bar: {ref: 'foo'},
    });

    const result: Record<string, JtdRootNode<any>> = {
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

describe('parseJtd', () => {

  test('parses type', () => {
    const result: JtdNode<any> = {
      nodeType: JtdNodeType.TYPE,
      type: JtdType.STRING,
      parentNode: null,
      jtd: {type: JtdType.STRING},
    };

    expect(parseJtd({type: JtdType.STRING})).toEqual(result);
  });

  test('parses ref', () => {
    const result: JtdNode<any> = {
      nodeType: JtdNodeType.REF,
      ref: 'foo',
      parentNode: null,
      jtd: {ref: 'foo'},
    };

    expect(parseJtd({ref: 'foo'})).toEqual(result);
  });

  test('parses enum', () => {
    const result: JtdNode<any> = {
      nodeType: JtdNodeType.ENUM,
      values: ['FOO', 'BAR'],
      parentNode: null,
      jtd: {
        enum: ['FOO', 'BAR'],
      },
    };

    expect(parseJtd({enum: ['FOO', 'BAR']})).toEqual(result);
  });

  test('parses elements', () => {
    const node = parseJtd({elements: {type: JtdType.STRING}});

    const result: JtdNode<any> = {
      nodeType: JtdNodeType.ELEMENTS,
      elementNode: {
        nodeType: JtdNodeType.TYPE,
        type: JtdType.STRING,
        parentNode: null,
        jtd: {type: JtdType.STRING},
      },
      parentNode: null,
      jtd: {
        elements: {type: JtdType.STRING},
      },
    };
    result.elementNode.parentNode = result;

    expect(node).toEqual(result);
  });

  test('parses values', () => {
    const node = parseJtd({values: {type: JtdType.STRING}});

    const result: JtdNode<any> = {
      nodeType: JtdNodeType.VALUES,
      valueNode: {
        nodeType: JtdNodeType.TYPE,
        type: JtdType.STRING,
        parentNode: null,
        jtd: {type: JtdType.STRING},
      },
      parentNode: null,
      jtd: {
        values: {type: JtdType.STRING},
      },
    };
    result.valueNode.parentNode = result;

    expect(node).toEqual(result);
  });

  test('parses properties', () => {
    const node = parseJtd({
      properties: {
        foo: {type: JtdType.STRING},
      },
    });

    const result: JtdNode<any> = {
      nodeType: JtdNodeType.OBJECT,
      propertyNodes: [
        {
          nodeType: JtdNodeType.PROPERTY,
          key: 'foo',
          optional: false,
          valueNode: {
            nodeType: JtdNodeType.TYPE,
            type: JtdType.STRING,
            parentNode: null,
            jtd: {type: JtdType.STRING},
          },
          parentNode: null as any,
          jtd: {type: JtdType.STRING},
        },
      ],
      parentNode: null,
      jtd: {
        properties: {
          foo: {type: JtdType.STRING},
        },
      },
    };

    result.propertyNodes[0].parentNode = result;
    result.propertyNodes[0].valueNode.parentNode = result.propertyNodes[0];

    expect(node).toEqual(result);
  });

  test('parses optionalProperties', () => {
    const node = parseJtd({
      optionalProperties: {
        foo: {type: JtdType.STRING},
      },
    });

    const result: JtdNode<any> = {
      nodeType: JtdNodeType.OBJECT,
      propertyNodes: [
        {
          nodeType: JtdNodeType.PROPERTY,
          key: 'foo',
          optional: true,
          valueNode: {
            nodeType: JtdNodeType.TYPE,
            type: JtdType.STRING,
            parentNode: null,
            jtd: {type: JtdType.STRING},
          },
          parentNode: null as any,
          jtd: {type: JtdType.STRING},
        },
      ],
      parentNode: null,
      jtd: {
        optionalProperties: {
          foo: {type: JtdType.STRING},
        },
      },
    };
    result.propertyNodes[0].parentNode = result;
    result.propertyNodes[0].valueNode.parentNode = result.propertyNodes[0];

    expect(node).toEqual(result);
  });

  test('parses both properties and optionalProperties', () => {
    const node = parseJtd({
      properties: {
        foo: {type: JtdType.STRING},
      },
      optionalProperties: {
        bar: {type: JtdType.INT8},
      },
    });

    const result: JtdNode<any> = {
      nodeType: JtdNodeType.OBJECT,
      propertyNodes: [
        {
          nodeType: JtdNodeType.PROPERTY,
          key: 'foo',
          optional: false,
          valueNode: {
            nodeType: JtdNodeType.TYPE,
            type: JtdType.STRING,
            parentNode: null,
            jtd: {type: JtdType.STRING},
          },
          parentNode: null as any,
          jtd: {type: JtdType.STRING},
        },
        {
          nodeType: JtdNodeType.PROPERTY,
          key: 'bar',
          optional: true,
          valueNode: {
            nodeType: JtdNodeType.TYPE,
            type: JtdType.INT8,
            parentNode: null,
            jtd: {type: JtdType.INT8},
          },
          parentNode: null as any,
          jtd: {type: JtdType.INT8},
        },
      ],
      parentNode: null,
      jtd: {
        properties: {
          foo: {type: JtdType.STRING},
        },
        optionalProperties: {
          bar: {type: JtdType.INT8},
        },
      },
    };
    result.propertyNodes[0].parentNode = result;
    result.propertyNodes[0].valueNode.parentNode = result.propertyNodes[0];
    result.propertyNodes[1].parentNode = result;
    result.propertyNodes[1].valueNode.parentNode = result.propertyNodes[1];

    expect(node).toEqual(result);
  });

  test('throws if property key is defined in both properties and optionalProperties', () => {
    expect(() => parseJtd({
      properties: {
        foo: {type: JtdType.STRING},
      },
      optionalProperties: {
        foo: {type: JtdType.STRING},
      },
    })).toThrow();
  });

  test('parses discriminated union', () => {
    const node = parseJtd({
      discriminator: 'type',
      mapping: {
        AAA: {
          properties: {
            foo: {type: JtdType.STRING},
          },
        },
        BBB: {
          properties: {
            bar: {type: JtdType.INT8},
          },
        },
      },
    });

    const result: JtdNode<any> = {
      nodeType: JtdNodeType.UNION,
      discriminator: 'type',
      mappingNodes: [
        {
          nodeType: JtdNodeType.MAPPING,
          key: 'AAA',
          objectNode: {
            nodeType: JtdNodeType.OBJECT,
            propertyNodes: [
              {
                nodeType: JtdNodeType.PROPERTY,
                key: 'foo',
                optional: false,
                valueNode: {
                  nodeType: JtdNodeType.TYPE,
                  type: JtdType.STRING,
                  parentNode: null,
                  jtd: {type: JtdType.STRING},
                },
                parentNode: null as any,
                jtd: {type: JtdType.STRING},
              },
            ],
            parentNode: null,
            jtd: {
              properties: {
                foo: {type: JtdType.STRING},
              },
            },
          },
          parentNode: null as any,
          jtd: {
            properties: {
              foo: {type: JtdType.STRING},
            },
          },
        },
        {
          nodeType: JtdNodeType.MAPPING,
          key: 'BBB',
          objectNode: {
            nodeType: JtdNodeType.OBJECT,
            propertyNodes: [
              {
                nodeType: JtdNodeType.PROPERTY,
                key: 'bar',
                optional: false,
                valueNode: {
                  nodeType: JtdNodeType.TYPE,
                  type: JtdType.INT8,
                  parentNode: null,
                  jtd: {type: JtdType.INT8},
                },
                parentNode: null as any,
                jtd: {type: JtdType.INT8},
              },
            ],
            parentNode: null,
            jtd: {
              properties: {
                bar: {type: JtdType.INT8},
              },
            },
          },
          parentNode: null as any,
          jtd: {
            properties: {
              bar: {type: JtdType.INT8},
            },
          },
        },
      ],
      parentNode: null,
      jtd: {
        discriminator: 'type',
        mapping: {
          AAA: {
            properties: {
              foo: {type: JtdType.STRING},
            },
          },
          BBB: {
            properties: {
              bar: {type: JtdType.INT8},
            },
          },
        },
      },
    };

    result.mappingNodes[0].parentNode = result;
    result.mappingNodes[1].parentNode = result;

    result.mappingNodes[0].objectNode.parentNode = result.mappingNodes[0];
    result.mappingNodes[1].objectNode.parentNode = result.mappingNodes[1];

    result.mappingNodes[0].objectNode.propertyNodes[0].parentNode = result.mappingNodes[0].objectNode;
    result.mappingNodes[1].objectNode.propertyNodes[0].parentNode = result.mappingNodes[1].objectNode;

    result.mappingNodes[0].objectNode.propertyNodes[0].valueNode.parentNode = result.mappingNodes[0].objectNode.propertyNodes[0];
    result.mappingNodes[1].objectNode.propertyNodes[0].valueNode.parentNode = result.mappingNodes[1].objectNode.propertyNodes[0];

    expect(node).toEqual(result);
  });

  test('throws on discriminated union if discriminator is absent', () => {
    expect(() => parseJtd({
      mapping: {
        AAA: {properties: {foo: {type: JtdType.STRING}}},
        BBB: {properties: {foo: {type: JtdType.INT8}}},
      },
    })).toThrow();
  });

  test('throws on discriminated union if mapping is absent', () => {
    expect(() => parseJtd({
      mapping: {
        AAA: {properties: {foo: {type: JtdType.STRING}}},
        BBB: {properties: {foo: {type: JtdType.INT8}}},
      },
    })).toThrow();
  });

  test('parses any', () => {
    const result: JtdNode<any> = {
      nodeType: JtdNodeType.ANY,
      parentNode: null,
      jtd: {},
    };

    expect(parseJtd({})).toEqual(result);
  });

  test('parses nullable', () => {

    const node = parseJtd({
      type: JtdType.STRING,
      nullable: true,
    });

    const result: JtdNode<any> = {
      nodeType: JtdNodeType.NULLABLE,
      valueNode: {
        nodeType: JtdNodeType.TYPE,
        type: JtdType.STRING,
        parentNode: null,
        jtd: {type: JtdType.STRING},
      },
      parentNode: null,
      jtd: {
        type: JtdType.STRING,
        nullable: true,
      },
    };

    result.valueNode.parentNode = result;

    expect(node).toEqual(result);
  });
});
