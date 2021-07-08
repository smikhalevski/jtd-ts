import {
  checkRequired,
  raiseIllegalType,
  raiseInvalid,
  raiseValidationError,
  ValidationErrorCode,
} from '../../main/validator/runtime';
import {IValidationError} from '../../main/validator';

describe('raiseValidationError', () => {

  test('appends an error', () => {
    const errors: Array<IValidationError> = [];
    expect(raiseValidationError('foo', errors, '/bar')).toBe(false);
    expect(errors).toEqual([{code: 'foo', pointer: '/bar'}]);
  });
});

describe('raiseIllegalType', () => {

  test('appends an illegal type error', () => {
    const errors: Array<IValidationError> = [];
    expect(raiseIllegalType(errors, '/bar')).toBe(false);
    expect(errors).toEqual([{code: ValidationErrorCode.ILLEGAL_TYPE, pointer: '/bar'}]);
  });
});

describe('raiseInvalid', () => {

  test('appends an invalid error', () => {
    const errors: Array<IValidationError> = [];
    expect(raiseInvalid(errors, '/bar')).toBe(false);
    expect(errors).toEqual([{code: ValidationErrorCode.INVALID, pointer: '/bar'}]);
  });
});

describe('checkRequired', () => {

  test('appends a required error for null', () => {
    const errors: Array<IValidationError> = [];
    expect(checkRequired(null, errors)).toBe(false);
    expect(errors).toEqual([{code: ValidationErrorCode.REQUIRED, pointer: ''}]);
  });

  test('appends a required error for undefined', () => {
    const errors: Array<IValidationError> = [];
    expect(checkRequired(undefined, errors)).toBe(false);
    expect(errors).toEqual([{code: ValidationErrorCode.REQUIRED, pointer: ''}]);
  });

  test('does not append an error for object', () => {
    const errors: Array<IValidationError> = [];
    expect(checkRequired({}, errors)).toBe(true);
    expect(errors).toEqual([]);
  });
});
