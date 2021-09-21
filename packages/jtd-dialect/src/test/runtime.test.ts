import {
  checkArray,
  checkObject,
  checkRequired,
  isValidationCompleted,
  IValidationContext,
  raiseIllegalType,
  raiseInvalid,
  raiseValidationError,
  rejectExcluded,
  ValidationErrorCode,
} from '../main/runtime';

describe('isValidationCompleted', () => {

  test('returns true if shallow with errors', () => {
    expect(isValidationCompleted({shallow: true, errors: [{pointer: 'foo', code: 123}]})).toBe(true);
  });

  test('returns false if shallow without errors', () => {
    expect(isValidationCompleted({shallow: true, errors: []})).toBe(false);
    expect(isValidationCompleted({shallow: true})).toBe(false);
  });

  test('returns false if not shallow with errors', () => {
    expect(isValidationCompleted({errors: [{pointer: 'foo', code: 123}]})).toBe(false);
  });
});

describe('rejectExcluded', () => {

  test('returns true on non-excluded value', () => {
    expect(rejectExcluded({}, {})).toBe(true);
  });

  test('returns false on excluded value', () => {
    const value = {};
    expect(rejectExcluded(value, {excluded: new Set([value])})).toBe(false);
  });
});

describe('raiseValidationError', () => {

  test('adds an error', () => {
    const ctx: IValidationContext = {};

    expect(raiseValidationError(123, ctx, 'foo')).toBe(false);
    expect(ctx).toEqual<IValidationContext>({errors: [{pointer: 'foo', code: 123}]});
  });
});

describe('checkRequired', () => {

  test('appends a required error for null', () => {
    const ctx: IValidationContext = {};

    expect(checkRequired(null, ctx, 'foo')).toBe(false);
    expect(ctx).toEqual<IValidationContext>({errors: [{code: ValidationErrorCode.REQUIRED, pointer: 'foo'}]});
  });

  test('appends a required error for undefined', () => {
    const ctx: IValidationContext = {};

    expect(checkRequired(undefined, ctx, 'foo')).toBe(false);
    expect(ctx).toEqual<IValidationContext>({errors: [{code: ValidationErrorCode.REQUIRED, pointer: 'foo'}]});
  });

  test('does not append an error for object', () => {
    const ctx: IValidationContext = {};

    expect(checkRequired({}, ctx, 'foo')).toBe(true);
    expect(ctx).toEqual<IValidationContext>({});
  });

  test('returns false if validation is completed', () => {
    const ctx: IValidationContext = {shallow: true, errors: [{pointer: 'bar', code: 123}]};

    expect(checkRequired(null, ctx, 'foo')).toBe(false);
    expect(checkRequired({}, ctx, 'foo')).toBe(false);
    expect(ctx).toEqual<IValidationContext>({shallow: true, errors: [{pointer: 'bar', code: 123}]});
  });
});

describe('raiseIllegalType', () => {

  test('appends an illegal type error', () => {
    const ctx: IValidationContext = {};

    expect(raiseIllegalType(ctx, 'foo')).toBe(false);
    expect(ctx).toEqual({errors: [{code: ValidationErrorCode.ILLEGAL_TYPE, pointer: 'foo'}]});
  });
});

describe('raiseInvalid', () => {

  test('appends an invalid error', () => {
    const ctx: IValidationContext = {};

    expect(raiseInvalid(ctx, 'foo')).toBe(false);
    expect(ctx).toEqual({errors: [{code: ValidationErrorCode.INVALID, pointer: 'foo'}]});
  });
});

describe('checkArray', () => {

  test('returns true if value is an array', () => {
    const ctx: IValidationContext = {};

    expect(checkArray([], ctx, 'foo')).toBe(true);
  });

  test('returns false if value is not an array', () => {
    const ctx: IValidationContext = {};

    expect(checkArray({}, ctx, 'foo')).toBe(false);
    expect(ctx).toEqual({errors: [{code: ValidationErrorCode.ILLEGAL_TYPE, pointer: 'foo'}]});
  });

  test('returns false if value is array-like', () => {
    const ctx: IValidationContext = {};

    expect(checkArray({0: 'a', length: 1}, ctx, 'foo')).toBe(false);
    expect(ctx).toEqual({errors: [{code: ValidationErrorCode.ILLEGAL_TYPE, pointer: 'foo'}]});
  });

  test('returns false if null', () => {
    const ctx: IValidationContext = {};

    expect(checkArray(null, ctx, 'foo')).toBe(false);
    expect(ctx).toEqual({errors: [{code: ValidationErrorCode.REQUIRED, pointer: 'foo'}]});
  });

  test('returns false if validation is complete', () => {
    const ctx: IValidationContext = {shallow: true, errors: [{pointer: 'foo', code: 123}]};

    expect(checkArray(null, ctx, 'foo')).toBe(false);
    expect(ctx).toEqual({shallow: true, errors: [{pointer: 'foo', code: 123}]});
  });

  test('returns false if value is excluded', () => {
    const value: Array<unknown> = [];
    const ctx: IValidationContext = {excluded: new Set([value])};

    expect(checkArray(value, ctx, 'foo')).toBe(false);
    expect(ctx).toEqual({excluded: new Set([value])});
  });
});

describe('checkObject', () => {

  test('returns true if value is an object', () => {
    const ctx: IValidationContext = {};

    expect(checkObject([], ctx, 'foo')).toBe(true);
    expect(checkObject({}, ctx, 'foo')).toBe(true);
    expect(checkObject(new Number(123), ctx, 'foo')).toBe(true);
  });

  test('returns false if value is not an object', () => {
    const ctx: IValidationContext = {};

    expect(checkObject(123, ctx, 'foo')).toBe(false);
    expect(ctx).toEqual({errors: [{code: ValidationErrorCode.ILLEGAL_TYPE, pointer: 'foo'}]});
  });

  test('returns false if null', () => {
    const ctx: IValidationContext = {};

    expect(checkObject(null, ctx, 'foo')).toBe(false);
    expect(ctx).toEqual({errors: [{code: ValidationErrorCode.REQUIRED, pointer: 'foo'}]});
  });

  test('returns false if validation is complete', () => {
    const ctx: IValidationContext = {shallow: true, errors: [{pointer: 'foo', code: 123}]};

    expect(checkObject(null, ctx, 'foo')).toBe(false);
    expect(ctx).toEqual({shallow: true, errors: [{pointer: 'foo', code: 123}]});
  });

  test('returns false if value is excluded', () => {
    const value = {};
    const ctx: IValidationContext = {excluded: new Set([value])};

    expect(checkObject(value, ctx, 'foo')).toBe(false);
    expect(ctx).toEqual({excluded: new Set([value])});
  });
});
