import {JtdNodeType, parseJtd, visitJtdNode} from '../main';

describe('visitJtdNode', () => {

  test('visits any', () => {
    const anyFn = jest.fn();
    visitJtdNode(parseJtd({}), {any: anyFn});

    expect(anyFn).toHaveBeenCalledTimes(1);
    expect(anyFn).toHaveBeenNthCalledWith(1, expect.objectContaining({nodeType: JtdNodeType.ANY}));
  });

  test('visits ref', () => {
    const refFn = jest.fn();
    visitJtdNode(parseJtd({ref: 'foo'}), {ref: refFn});

    expect(refFn).toHaveBeenCalledTimes(1);
    expect(refFn).toHaveBeenNthCalledWith(1, expect.objectContaining({nodeType: JtdNodeType.REF}));
  });

  test('visits type', () => {
    const typeFn = jest.fn();
    visitJtdNode(parseJtd({type: 'string'}), {type: typeFn});

    expect(typeFn).toHaveBeenCalledTimes(1);
    expect(typeFn).toHaveBeenNthCalledWith(1, expect.objectContaining({nodeType: JtdNodeType.TYPE}));
  });

  test('visits enum', () => {
    const enumFn = jest.fn();
    visitJtdNode(parseJtd({enum: ['FOO', 'BAR']}), {enum: enumFn});

    expect(enumFn).toHaveBeenCalledTimes(1);
    expect(enumFn).toHaveBeenNthCalledWith(1, expect.objectContaining({nodeType: JtdNodeType.ENUM}), expect.any(Function));
  });

  test('visits enum values', () => {
    const enumValueFn = jest.fn();
    visitJtdNode(parseJtd({enum: ['FOO', 'BAR']}), {enum: (node, next) => next(), enumValue: enumValueFn});

    expect(enumValueFn).toHaveBeenCalledTimes(2);
    expect(enumValueFn).toHaveBeenNthCalledWith(1, 'FOO', expect.objectContaining({nodeType: JtdNodeType.ENUM}));
    expect(enumValueFn).toHaveBeenNthCalledWith(2, 'BAR', expect.objectContaining({nodeType: JtdNodeType.ENUM}));
  });

  test('visits elements', () => {
    const elementsFn = jest.fn();
    visitJtdNode(parseJtd({elements: {type: 'string'}}), {elements: elementsFn});

    expect(elementsFn).toHaveBeenCalledTimes(1);
    expect(elementsFn).toHaveBeenNthCalledWith(1, expect.objectContaining({nodeType: JtdNodeType.ELEMENTS}), expect.any(Function));
  });

  test('visits values', () => {
    const valuesFn = jest.fn();
    visitJtdNode(parseJtd({values: {type: 'string'}}), {values: valuesFn});

    expect(valuesFn).toHaveBeenCalledTimes(1);
    expect(valuesFn).toHaveBeenNthCalledWith(1, expect.objectContaining({nodeType: JtdNodeType.VALUES}), expect.any(Function));
  });

  test('visits object', () => {
    const objectFn = jest.fn();
    visitJtdNode(parseJtd({properties: {foo: {type: 'string'}}}), {object: objectFn});

    expect(objectFn).toHaveBeenCalledTimes(1);
    expect(objectFn).toHaveBeenNthCalledWith(1, expect.objectContaining({nodeType: JtdNodeType.OBJECT}), expect.any(Function));
  });

  test('visits object properties', () => {
    const propertyFn = jest.fn();
    visitJtdNode(parseJtd({
      properties: {
        foo: {type: 'string'},
        bar: {enum: ['AAA']},
      },
    }), {object: (node, next) => next(), property: propertyFn});

    expect(propertyFn).toHaveBeenCalledTimes(2);
    expect(propertyFn).toHaveBeenNthCalledWith(1,
        'foo',
        expect.objectContaining({nodeType: JtdNodeType.TYPE}),
        expect.objectContaining({nodeType: JtdNodeType.OBJECT}),
        expect.any(Function),
    );
    expect(propertyFn).toHaveBeenNthCalledWith(2,
        'bar',
        expect.objectContaining({nodeType: JtdNodeType.ENUM}),
        expect.objectContaining({nodeType: JtdNodeType.OBJECT}),
        expect.any(Function),
    );
  });

  test('visits object optional properties', () => {
    const optionalPropertyFn = jest.fn();
    visitJtdNode(parseJtd({
      optionalProperties: {
        foo: {type: 'string'},
        bar: {enum: ['AAA']},
      },
    }), {object: (node, next) => next(), optionalProperty: optionalPropertyFn});

    expect(optionalPropertyFn).toHaveBeenCalledTimes(2);
    expect(optionalPropertyFn).toHaveBeenNthCalledWith(1,
        'foo',
        expect.objectContaining({nodeType: JtdNodeType.TYPE}),
        expect.objectContaining({nodeType: JtdNodeType.OBJECT}),
        expect.any(Function),
    );
    expect(optionalPropertyFn).toHaveBeenNthCalledWith(2,
        'bar',
        expect.objectContaining({nodeType: JtdNodeType.ENUM}),
        expect.objectContaining({nodeType: JtdNodeType.OBJECT}),
        expect.any(Function),
    );
  });

  test('visits discriminated union', () => {
    const unionFn = jest.fn();
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
    }), {union: unionFn});

    expect(unionFn).toHaveBeenCalledTimes(1);
    expect(unionFn).toHaveBeenNthCalledWith(1, expect.objectContaining({nodeType: JtdNodeType.UNION}), expect.any(Function));
  });

  test('visits discriminated union mapping', () => {
    const unionMappingFn = jest.fn();
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
    }), {union: (node, next) => next(), unionMapping: unionMappingFn});

    expect(unionMappingFn).toHaveBeenCalledTimes(2);
    expect(unionMappingFn).toHaveBeenNthCalledWith(1,
        'AAA',
        expect.objectContaining({nodeType: JtdNodeType.OBJECT}),
        expect.objectContaining({nodeType: JtdNodeType.UNION}),
        expect.any(Function),
    );
    expect(unionMappingFn).toHaveBeenNthCalledWith(2,
        'BBB',
        expect.objectContaining({nodeType: JtdNodeType.OBJECT}),
        expect.objectContaining({nodeType: JtdNodeType.UNION}),
        expect.any(Function),
    );
  });

});
