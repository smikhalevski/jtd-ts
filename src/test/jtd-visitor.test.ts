import {JtdNodeType} from '../main/jtd-ast-types';
import {parseJtd} from '../main/jtd-ast';
import {visitJtdNode} from '../main/jtd-visitor';
import {JtdType} from '../main/jtd-types';

describe('visitJtdNode', () => {

  test('visits any', () => {
    const visitAnyMock = jest.fn();
    visitJtdNode(parseJtd({}), {visitAny: visitAnyMock});

    expect(visitAnyMock).toHaveBeenCalledTimes(1);
    expect(visitAnyMock).toHaveBeenNthCalledWith(1, expect.objectContaining({nodeType: JtdNodeType.ANY}));
  });

  test('visits ref', () => {
    const visitRefMock = jest.fn();
    visitJtdNode(parseJtd({ref: 'foo'}), {visitRef: visitRefMock});

    expect(visitRefMock).toHaveBeenCalledTimes(1);
    expect(visitRefMock).toHaveBeenNthCalledWith(1, expect.objectContaining({nodeType: JtdNodeType.REF}));
  });

  test('visits type', () => {
    const visitTypeMock = jest.fn();
    visitJtdNode(parseJtd({type: 'string'}), {visitType: visitTypeMock});

    expect(visitTypeMock).toHaveBeenCalledTimes(1);
    expect(visitTypeMock).toHaveBeenNthCalledWith(1, expect.objectContaining({nodeType: JtdNodeType.TYPE}));
  });

  test('visits enum', () => {
    const visitEnumMock = jest.fn();
    visitJtdNode(parseJtd({enum: ['FOO', 'BAR']}), {visitEnum: visitEnumMock});

    expect(visitEnumMock).toHaveBeenCalledTimes(1);
    expect(visitEnumMock).toHaveBeenNthCalledWith(1, expect.objectContaining({nodeType: JtdNodeType.ENUM}), expect.any(Function));
  });

  test('visits enum values', () => {
    const visitEnumValueMock = jest.fn();
    visitJtdNode(parseJtd({enum: ['FOO', 'BAR']}), {
      visitEnum: (node, next) => next(),
      visitEnumValue: visitEnumValueMock,
    });

    expect(visitEnumValueMock).toHaveBeenCalledTimes(2);
    expect(visitEnumValueMock).toHaveBeenNthCalledWith(1, 'FOO', expect.objectContaining({nodeType: JtdNodeType.ENUM}));
    expect(visitEnumValueMock).toHaveBeenNthCalledWith(2, 'BAR', expect.objectContaining({nodeType: JtdNodeType.ENUM}));
  });

  test('visits elements', () => {
    const visitElementsMock = jest.fn();
    visitJtdNode(parseJtd({elements: {type: 'string'}}), {visitElements: visitElementsMock});

    expect(visitElementsMock).toHaveBeenCalledTimes(1);
    expect(visitElementsMock).toHaveBeenNthCalledWith(1, expect.objectContaining({nodeType: JtdNodeType.ELEMENTS}), expect.any(Function));
  });

  test('visits values', () => {
    const visitValuesMock = jest.fn();
    visitJtdNode(parseJtd({values: {type: 'string'}}), {visitValues: visitValuesMock});

    expect(visitValuesMock).toHaveBeenCalledTimes(1);
    expect(visitValuesMock).toHaveBeenNthCalledWith(1, expect.objectContaining({nodeType: JtdNodeType.VALUES}), expect.any(Function));
  });

  test('visits object', () => {
    const visitObjectMock = jest.fn();
    visitJtdNode(parseJtd({properties: {foo: {type: 'string'}}}), {visitObject: visitObjectMock});

    expect(visitObjectMock).toHaveBeenCalledTimes(1);
    expect(visitObjectMock).toHaveBeenNthCalledWith(1, expect.objectContaining({nodeType: JtdNodeType.OBJECT}), expect.any(Function));
  });

  test('visits object properties', () => {
    const visitPropertyMock = jest.fn();
    visitJtdNode(parseJtd({
      properties: {
        foo: {type: 'string'},
        bar: {enum: ['AAA']},
      },
    }), {visitObject: (node, next) => next(), visitProperty: visitPropertyMock});

    expect(visitPropertyMock).toHaveBeenCalledTimes(2);
    expect(visitPropertyMock).toHaveBeenNthCalledWith(1,
        'foo',
        expect.objectContaining({nodeType: JtdNodeType.TYPE}),
        expect.objectContaining({nodeType: JtdNodeType.OBJECT}),
        expect.any(Function),
    );
    expect(visitPropertyMock).toHaveBeenNthCalledWith(2,
        'bar',
        expect.objectContaining({nodeType: JtdNodeType.ENUM}),
        expect.objectContaining({nodeType: JtdNodeType.OBJECT}),
        expect.any(Function),
    );
  });

  test('visits object optional properties', () => {
    const visitOptionalPropertyMock = jest.fn();
    visitJtdNode(parseJtd({
      optionalProperties: {
        foo: {type: 'string'},
        bar: {enum: ['AAA']},
      },
    }), {visitObject: (node, next) => next(), visitOptionalProperty: visitOptionalPropertyMock});

    expect(visitOptionalPropertyMock).toHaveBeenCalledTimes(2);
    expect(visitOptionalPropertyMock).toHaveBeenNthCalledWith(1,
        'foo',
        expect.objectContaining({nodeType: JtdNodeType.TYPE}),
        expect.objectContaining({nodeType: JtdNodeType.OBJECT}),
        expect.any(Function),
    );
    expect(visitOptionalPropertyMock).toHaveBeenNthCalledWith(2,
        'bar',
        expect.objectContaining({nodeType: JtdNodeType.ENUM}),
        expect.objectContaining({nodeType: JtdNodeType.OBJECT}),
        expect.any(Function),
    );
  });

  test('visits discriminated union', () => {
    const visitUnionMock = jest.fn();
    visitJtdNode(parseJtd({
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
    }), {visitUnion: visitUnionMock});

    expect(visitUnionMock).toHaveBeenCalledTimes(1);
    expect(visitUnionMock).toHaveBeenNthCalledWith(1, expect.objectContaining({nodeType: JtdNodeType.UNION}), expect.any(Function));
  });

  test('visits discriminated union mapping', () => {
    const visitUnionMappingMock = jest.fn();
    visitJtdNode(parseJtd({
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
    }), {visitUnion: (node, next) => next(), visitUnionMapping: visitUnionMappingMock});

    expect(visitUnionMappingMock).toHaveBeenCalledTimes(2);
    expect(visitUnionMappingMock).toHaveBeenNthCalledWith(1,
        'AAA',
        expect.objectContaining({nodeType: JtdNodeType.OBJECT}),
        expect.objectContaining({nodeType: JtdNodeType.UNION}),
        expect.any(Function),
    );
    expect(visitUnionMappingMock).toHaveBeenNthCalledWith(2,
        'BBB',
        expect.objectContaining({nodeType: JtdNodeType.OBJECT}),
        expect.objectContaining({nodeType: JtdNodeType.UNION}),
        expect.any(Function),
    );
  });

  test('visits transient', () => {
    const visitTypeMock = jest.fn();
    visitJtdNode(parseJtd({
      discriminator: 'foo',
      mapping: {
        qqq: {
          properties: {
            aaa: {
              values: {
                elements: {
                  nullable: true,
                  type: JtdType.BOOLEAN,
                },
              },
            },
          },
        },
      },
    }), {transient: true, visitType: visitTypeMock});

    expect(visitTypeMock).toHaveBeenCalledTimes(1);
  });

});
