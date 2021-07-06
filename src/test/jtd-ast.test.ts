import {JtdNodeType} from '../main/jtd-ast-types';
import {parseJtd, parseJtdDefinitions, parseJtdRoot} from '../main/jtd-ast';

describe('parseJtdRoot', () => {

  test('parses JTD with definitions', () => {
    expect(parseJtdRoot('bar', {
      definitions: {
        foo: {type: 'string'},
      },
      ref: 'foo',
    })).toEqual({
      foo: {
        jtd: {type: 'string'},
        nodeType: JtdNodeType.TYPE,
        type: 'string',
      },
      bar: {
        jtd: {
          definitions: {
            foo: {type: 'string'},
          },
          ref: 'foo',
        },
        nodeType: JtdNodeType.REF,
        ref: 'foo',
      },
    });
  });
});

describe('parseJtdDefinitions', () => {

  test('parses definitions', () => {
    expect(parseJtdDefinitions({
      foo: {type: 'string'},
      bar: {ref: 'foo'},
    })).toEqual({
      foo: {
        jtd: {type: 'string'},
        nodeType: JtdNodeType.TYPE,
        type: 'string',
      },
      bar: {
        jtd: {ref: 'foo'},
        nodeType: JtdNodeType.REF,
        ref: 'foo',
      },
    });
  });
});

describe('parseJtd', () => {

  test('parses type', () => {
    expect(parseJtd({type: 'string'})).toEqual({
      jtd: {
        type: 'string',
      },
      nodeType: JtdNodeType.TYPE,
      type: 'string',
    });
  });

  test('parses ref', () => {
    expect(parseJtd({ref: 'foo'})).toEqual({
      jtd: {
        ref: 'foo',
      },
      nodeType: JtdNodeType.REF,
      ref: 'foo',
    });
  });

  test('parses enum', () => {
    expect(parseJtd({enum: ['FOO', 'BAR']})).toEqual({
      jtd: {
        enum: ['FOO', 'BAR'],
      },
      nodeType: JtdNodeType.ENUM,
      values: ['FOO', 'BAR'],
    });
  });

  test('parses elements', () => {
    expect(parseJtd({elements: {type: 'string'}})).toEqual({
      jtd: {
        elements: {type: 'string'},
      },
      nodeType: JtdNodeType.ELEMENTS,
      elementNode: {
        jtd: {
          type: 'string',
        },
        nodeType: JtdNodeType.TYPE,
        type: 'string',
      },
    });
  });

  test('parses values', () => {
    expect(parseJtd({values: {type: 'string'}})).toEqual({
      jtd: {
        values: {type: 'string'},
      },
      nodeType: JtdNodeType.VALUES,
      valueNode: {
        jtd: {
          type: 'string',
        },
        nodeType: JtdNodeType.TYPE,
        type: 'string',
      },
    });
  });

  test('parses properties', () => {
    expect(parseJtd({
      properties: {foo: {type: 'string'}},
    })).toEqual({
      jtd: {
        properties: {foo: {type: 'string'}},
      },
      nodeType: JtdNodeType.OBJECT,
      properties: {
        foo: {
          jtd: {
            type: 'string',
          },
          nodeType: JtdNodeType.TYPE,
          type: 'string',
        },
      },
      optionalProperties: {},
    });
  });

  test('parses optionalProperties', () => {
    expect(parseJtd({
      optionalProperties: {foo: {type: 'string'}},
    })).toEqual({
      jtd: {
        optionalProperties: {foo: {type: 'string'}},
      },
      nodeType: JtdNodeType.OBJECT,
      properties: {},
      optionalProperties: {
        foo: {
          jtd: {
            type: 'string',
          },
          nodeType: JtdNodeType.TYPE,
          type: 'string',
        },
      },
    });
  });

  test('parses both properties and optionalProperties', () => {
    expect(parseJtd({
      properties: {foo: {type: 'string'}},
      optionalProperties: {bar: {type: 'string'}},
    })).toEqual({
      jtd: {
        properties: {foo: {type: 'string'}},
        optionalProperties: {bar: {type: 'string'}},
      },
      nodeType: JtdNodeType.OBJECT,
      properties: {
        foo: {
          jtd: {
            type: 'string',
          },
          nodeType: JtdNodeType.TYPE,
          type: 'string',
        },
      },
      optionalProperties: {
        bar: {
          jtd: {
            type: 'string',
          },
          nodeType: JtdNodeType.TYPE,
          type: 'string',
        },
      },
    });
  });

  test('throws if property key is defined in both properties and optionalProperties', () => {
    expect(() => parseJtd({
      properties: {foo: {type: 'string'}},
      optionalProperties: {foo: {type: 'string'}},
    })).toThrow();
  });

  test('parses discriminated union', () => {
    expect(parseJtd({
      discriminator: 'type',
      mapping: {
        AAA: {
          properties: {
            foo: {type: 'string'},
          },
        },
        BBB: {
          properties: {
            foo: {type: 'number'},
          },
        },
      },
    })).toEqual({
      jtd: {
        discriminator: 'type',
        mapping: {
          AAA: {
            properties: {
              foo: {type: 'string'},
            },
          },
          BBB: {
            properties: {
              foo: {type: 'number'},
            },
          },
        },
      },
      nodeType: JtdNodeType.UNION,
      discriminator: 'type',
      mapping: {
        AAA: {
          jtd: {
            properties: {
              foo: {type: 'string'},
            },
          },
          nodeType: JtdNodeType.OBJECT,
          properties: {
            foo: {
              jtd: {
                type: 'string',
              },
              nodeType: JtdNodeType.TYPE,
              type: 'string',
            },
          },
          optionalProperties: {},
        },
        BBB: {
          jtd: {
            properties: {
              foo: {type: 'number'},
            },
          },
          nodeType: JtdNodeType.OBJECT,
          properties: {
            foo: {
              jtd: {
                type: 'number',
              },
              nodeType: JtdNodeType.TYPE,
              type: 'number',
            },
          },
          optionalProperties: {},
        },
      },
    });
  });

  test('ignores discriminated union if discriminator is absent', () => {
    expect(parseJtd({
      mapping: {
        AAA: {
          properties: {
            foo: {type: 'string'},
          },
        },
        BBB: {
          properties: {
            foo: {type: 'number'},
          },
        },
      },
    })).toEqual({
      jtd: {
        mapping: {
          AAA: {
            properties: {
              foo: {type: 'string'},
            },
          },
          BBB: {
            properties: {
              foo: {type: 'number'},
            },
          },
        },
      },
      nodeType: JtdNodeType.ANY,
    });
  });

  test('ignores discriminated union if mapping is absent', () => {
    expect(parseJtd({discriminator: 'type'})).toEqual({
      jtd: {
        discriminator: 'type',
      },
      nodeType: JtdNodeType.ANY,
    });
  });

  test('parses any', () => {
    expect(parseJtd({})).toEqual({
      jtd: {},
      nodeType: JtdNodeType.ANY,
    });
  });

  test('parses nullable', () => {
    expect(parseJtd({
      type: 'string',
      nullable: true,
    })).toEqual({
      jtd: {
        type: 'string',
        nullable: true,
      },
      nodeType: JtdNodeType.NULLABLE,
      valueNode: {
        jtd: {
          type: 'string',
        },
        nodeType: JtdNodeType.TYPE,
        type: 'string',
      },
    });
  });
});
