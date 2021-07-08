import {IValidationError, ValidationErrorCode} from '../../main/validator/runtime';
import {checkRequired} from '../../main/checker/runtime';

describe('checkRequired', () => {

  test('appends a required error for null', () => {
    const errors: Array<IValidationError> = [];
    expect(checkRequired(null, {errors}, '')).toBe(false);
    expect(errors).toEqual([{code: ValidationErrorCode.REQUIRED, pointer: ''}]);
  });

  test('appends a required error for undefined', () => {
    const errors: Array<IValidationError> = [];
    expect(checkRequired(undefined, {errors}, '')).toBe(false);
    expect(errors).toEqual([{code: ValidationErrorCode.REQUIRED, pointer: ''}]);
  });

  test('does not append an error for object', () => {
    const errors: Array<IValidationError> = [];
    expect(checkRequired({}, {errors}, '')).toBe(true);
    expect(errors).toEqual([]);
  });
});
