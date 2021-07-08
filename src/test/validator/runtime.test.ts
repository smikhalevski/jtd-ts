import {
  IValidationError,
  raiseIllegalType,
  raiseInvalid,
  raiseValidationError,
  ValidationErrorCode,
} from '../../main/validator/runtime';

describe('raiseValidationError', () => {

  test('appends an error', () => {
    const errors: Array<IValidationError> = [];
    expect(raiseValidationError('foo', {errors}, '/bar')).toBe(false);
    expect(errors).toEqual([{code: 'foo', pointer: '/bar'}]);
  });
});

describe('raiseIllegalType', () => {

  test('appends an illegal type error', () => {
    const errors: Array<IValidationError> = [];
    expect(raiseIllegalType({errors}, '/bar')).toBe(false);
    expect(errors).toEqual([{code: ValidationErrorCode.ILLEGAL_TYPE, pointer: '/bar'}]);
  });
});

describe('raiseInvalid', () => {

  test('appends an invalid error', () => {
    const errors: Array<IValidationError> = [];
    expect(raiseInvalid({errors}, '/bar')).toBe(false);
    expect(errors).toEqual([{code: ValidationErrorCode.INVALID, pointer: '/bar'}]);
  });
});
