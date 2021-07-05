import JsonPointer from 'json-pointer';
import {Checker, IValidationError, ValidationErrorCode} from './validator-types';

export function escapeJsonPointer(key: string | number): string {
  return JsonPointer.escape(key.toString());
}

export function raiseValidationError(code: string, errors: Array<IValidationError> | undefined, pointer = ''): false {
  errors?.push({pointer, code});
  return false;
}

export function raiseIllegalType(errors: Array<IValidationError> | undefined, pointer?: string): false {
  return raiseValidationError(ValidationErrorCode.ILLEGAL_TYPE, errors, pointer);
}

export function raiseInvalid(errors: Array<IValidationError> | undefined, pointer?: string): false {
  return raiseValidationError(ValidationErrorCode.INVALID, errors, pointer);
}

export const checkRequired: Checker<{}> = (value, errors, pointer): value is {} => {
  return value != null || raiseValidationError(ValidationErrorCode.REQUIRED, errors, pointer);
};

export const checkArray: Checker<Array<unknown>> = (value, errors, pointer): value is Array<unknown> => {
  return checkRequired(value, errors, pointer) && (Array.isArray(value) || raiseIllegalType(errors, pointer));
};

export const checkObject: Checker<Record<string, unknown>> = (value, errors, pointer): value is Record<string, unknown> => {
  return checkRequired(value, errors, pointer) && (typeof value === 'object' || raiseIllegalType(errors, pointer));
};

export const checkString: Checker<string> = (value, errors, pointer): value is string => {
  return checkRequired(value, errors, pointer) && (typeof value === 'string' || raiseIllegalType(errors, pointer));
};

export const checkNumber: Checker<number> = (value, errors, pointer): value is number => {
  return checkRequired(value, errors, pointer) && (Number.isFinite(value) || raiseIllegalType(errors, pointer));
};

export const checkInteger: Checker<number> = (value, errors, pointer): value is number => {
  return checkNumber(value, errors, pointer) && (Number.isInteger(value) || raiseInvalid(errors, pointer));
};

export const checkBigInt: Checker<bigint> = (value, errors, pointer): value is bigint => {
  return checkRequired(value, errors, pointer) && (typeof value === 'bigint' || raiseIllegalType(errors, pointer));
};

export const checkBoolean: Checker<boolean> = (value, errors, pointer): value is boolean => {
  return checkRequired(value, errors, pointer) && (typeof value === 'boolean' || raiseIllegalType(errors, pointer));
};

export function checkEnum(value: unknown, values: Set<string>, errors?: Array<IValidationError>, pointer?: string): value is string {
  return checkString(value, errors, pointer) && (values.has(value) || raiseInvalid(errors, pointer));
}

export function checkPattern(value: string, pattern: RegExp, errors?: Array<IValidationError>, pointer?: string): boolean {
  return pattern.test(value) || raiseInvalid(errors, pointer);
}

export function checkMinimum(value: number, minimum: number, errors?: Array<IValidationError>, pointer?: string): boolean {
  return value >= minimum || raiseInvalid(errors, pointer);
}

export function checkMaximum(value: number, maximum: number, errors?: Array<IValidationError>, pointer?: string): boolean {
  return value <= maximum || raiseInvalid(errors, pointer);
}

export function checkMultipleOf(value: number, multipleOf: number, errors?: Array<IValidationError>, pointer?: string): boolean {
  return value % multipleOf === 0 || raiseInvalid(errors, pointer);
}
