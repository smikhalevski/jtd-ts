import {JtdNodeType} from '../main/jtd-ast-types';
import {parseJtd} from '../main/jtd-ast';
import {visitJtdNode} from '../main/jtd-visitor';

describe('visitJtdNode', () => {

  test('visits any', () => {
    const anyMock = jest.fn();
    visitJtdNode(parseJtd({}), {any: anyMock});

    expect(anyMock).toHaveBeenCalledTimes(1);
    expect(anyMock).toHaveBeenNthCalledWith(1, expect.objectContaining({nodeType: JtdNodeType.ANY}));
  });

  test('visits ref', () => {
    const refMock = jest.fn();
    visitJtdNode(parseJtd({ref: 'foo'}), {ref: refMock});

    expect(refMock).toHaveBeenCalledTimes(1);
    expect(refMock).toHaveBeenNthCalledWith(1, expect.objectContaining({nodeType: JtdNodeType.REF}));
  });

  test('visits type', () => {
    const typeMock = jest.fn();
    visitJtdNode(parseJtd({type: 'string'}), {type: typeMock});

    expect(typeMock).toHaveBeenCalledTimes(1);
    expect(typeMock).toHaveBeenNthCalledWith(1, expect.objectContaining({nodeType: JtdNodeType.TYPE}));
  });

  test('visits enum', () => {
    const enumMock = jest.fn();
    visitJtdNode(parseJtd({enum: ['FOO', 'BAR']}), {enum: enumMock});

    expect(enumMock).toHaveBeenCalledTimes(1);
    expect(enumMock).toHaveBeenNthCalledWith(1, expect.objectContaining({nodeType: JtdNodeType.ENUM}), expect.any(Function));
  });

  test('visits enum values', () => {
    const enumValueMock = jest.fn();
    visitJtdNode(parseJtd({enum: ['FOO', 'BAR']}), {
      enum: (node, next) => next(),
      enumValue: enumValueMock,
    });

    expect(enumValueMock).toHaveBeenCalledTimes(2);
    expect(enumValueMock).toHaveBeenNthCalledWith(1, 'FOO', expect.objectContaining({nodeType: JtdNodeType.ENUM}));
    expect(enumValueMock).toHaveBeenNthCalledWith(2, 'BAR', expect.objectContaining({nodeType: JtdNodeType.ENUM}));
  });

  test('visits elements', () => {
    const elementsMock = jest.fn();
    visitJtdNode(parseJtd({elements: {type: 'string'}}), {elements: elementsMock});

    expect(elementsMock).toHaveBeenCalledTimes(1);
    expect(elementsMock).toHaveBeenNthCalledWith(1, expect.objectContaining({nodeType: JtdNodeType.ELEMENTS}), expect.any(Function));
  });

  test('visits values', () => {
    const valuesMock = jest.fn();
    visitJtdNode(parseJtd({values: {type: 'string'}}), {values: valuesMock});

    expect(valuesMock).toHaveBeenCalledTimes(1);
    expect(valuesMock).toHaveBeenNthCalledWith(1, expect.objectContaining({nodeType: JtdNodeType.VALUES}), expect.any(Function));
  });

  test('visits object', () => {
    const objectMock = jest.fn();
    visitJtdNode(parseJtd({properties: {foo: {type: 'string'}}}), {object: objectMock});

    expect(objectMock).toHaveBeenCalledTimes(1);
    expect(objectMock).toHaveBeenNthCalledWith(1, expect.objectContaining({nodeType: JtdNodeType.OBJECT}), expect.any(Function));
  });

  test('visits object properties', () => {
    const propertyMock = jest.fn();
    visitJtdNode(parseJtd({
      properties: {
        foo: {type: 'string'},
        bar: {enum: ['AAA']},
      },
    }), {object: (node, next) => next(), property: propertyMock});

    expect(propertyMock).toHaveBeenCalledTimes(2);
    expect(propertyMock).toHaveBeenNthCalledWith(1,
        'foo',
        expect.objectContaining({nodeType: JtdNodeType.TYPE}),
        expect.objectContaining({nodeType: JtdNodeType.OBJECT}),
        expect.any(Function),
    );
    expect(propertyMock).toHaveBeenNthCalledWith(2,
        'bar',
        expect.objectContaining({nodeType: JtdNodeType.ENUM}),
        expect.objectContaining({nodeType: JtdNodeType.OBJECT}),
        expect.any(Function),
    );
  });

  test('visits discriminated union', () => {
    const unionMock = jest.fn();
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
    }), {union: unionMock});

    expect(unionMock).toHaveBeenCalledTimes(1);
    expect(unionMock).toHaveBeenNthCalledWith(1, expect.objectContaining({nodeType: JtdNodeType.UNION}), expect.any(Function));
  });

  test('visits discriminated union mapping', () => {
    const unionMappingMock = jest.fn();
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
    }), {union: (node, next) => next(), mapping: unionMappingMock});

    expect(unionMappingMock).toHaveBeenCalledTimes(2);
    expect(unionMappingMock).toHaveBeenNthCalledWith(1,
        'AAA',
        expect.objectContaining({nodeType: JtdNodeType.OBJECT}),
        expect.objectContaining({nodeType: JtdNodeType.UNION}),
        expect.any(Function),
    );
    expect(unionMappingMock).toHaveBeenNthCalledWith(2,
        'BBB',
        expect.objectContaining({nodeType: JtdNodeType.OBJECT}),
        expect.objectContaining({nodeType: JtdNodeType.UNION}),
        expect.any(Function),
    );
  });

});
