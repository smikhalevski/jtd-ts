import JsonPointer from 'json-pointer';

export {
  escapeJsonPointer as p,
  raiseInvalid as r,
  checkObject as o,
  checkArray as a,
  checkEnum as e,
  checkBoolean as b,
  checkString as s,
  checkNumber as n,
  checkInteger as i,
};

/**
 * The context object that is passed to validators and checkers so they can act accordingly.
 */
export interface IValidationContext {

  /**
   * The list of errors collected during validation or `undefined` if no errors were captured.
   */
  errors?: Array<IValidationError>;

  /**
   * The list of values excluded from validation. This list gets populated when any object or array was validated so no
   * cyclic validation would occur. You can pre-populate this list to avoid excessive validation.
   */
  excludedValues?: Set<unknown>;

  /**
   * If set to `true` then validators and checkers should not check a passed value if there are any errors in the
   * context already. This would cause only the first error to be captured.
   */
  lazy?: boolean;
}

export const enum ValidationErrorCode {
  REQUIRED = 'required',
  ILLEGAL_TYPE = 'illegal_type',
  INVALID = 'invalid',
}

export interface IValidationError {

  /**
   * JSON pointer of the field that caused an error.
   */
  pointer: string;

  /**
   * The code of the detected error.
   */
  code: ValidationErrorCode | string | number;
}

/**
 * The validator is the function that ensures that that `value` is conforms the JTD. It returns the list errors of
 * errors or `undefined` if there were no errors.
 */
export interface Validator {

  /**
   * Validate the value.
   *
   * @param value The validated value.
   * @param context The context that holds errors and may be populated during validation.
   * @param pointer JSON pointer of the validated value.
   */
  (value: unknown, context?: IValidationContext, pointer?: string): Array<IValidationError> | undefined;

  /**
   * The cache object populated by the validator during execution.
   */
  cache?: Record<string, any>;
}

/**
 * Returns `true` if further checker invocations must be prevented.
 */
export function isValidationCompleted(ctx: IValidationContext): boolean {
  return !(!ctx.lazy || !ctx.errors || ctx.errors.length === 0);
}

export function escapeJsonPointer(key: string | number): string {
  return JsonPointer.escape(key.toString());
}

export function raiseValidationError(code: string, ctx: IValidationContext, pointer: string): false {
  ctx.errors ||= [];
  ctx.errors.push({pointer, code});
  return false;
}

export function raiseIllegalType(ctx: IValidationContext, pointer: string): false {
  return raiseValidationError(ValidationErrorCode.ILLEGAL_TYPE, ctx, pointer);
}

export function raiseInvalid(ctx: IValidationContext, pointer: string): false {
  return raiseValidationError(ValidationErrorCode.INVALID, ctx, pointer);
}

export function excludeValue(value: unknown, ctx: IValidationContext): true {
  ctx.excludedValues ||= new Set();
  ctx.excludedValues.add(value);
  return true;
}

export function checkRequired(value: unknown, ctx: IValidationContext, pointer: string): value is {} {
  return !isValidationCompleted(ctx) && (value != null || raiseValidationError(ValidationErrorCode.REQUIRED, ctx, pointer));
}

export function checkArray(value: unknown, ctx: IValidationContext, pointer: string): value is Array<unknown> {
  return checkRequired(value, ctx, pointer) && (Array.isArray(value) && excludeValue(value, ctx) || raiseIllegalType(ctx, pointer));
}

export function checkObject(value: unknown, ctx: IValidationContext, pointer: string): value is Record<string, unknown> {
  return checkRequired(value, ctx, pointer) && (typeof value === 'object' && excludeValue(value, ctx) || raiseIllegalType(ctx, pointer));
}

export function checkString(value: unknown, ctx: IValidationContext, pointer: string): value is string {
  return checkRequired(value, ctx, pointer) && (typeof value === 'string' || raiseIllegalType(ctx, pointer));
}

export function checkNumber(value: unknown, ctx: IValidationContext, pointer: string): value is number {
  return checkRequired(value, ctx, pointer) && (Number.isFinite(value) || raiseIllegalType(ctx, pointer));
}

export function checkInteger(value: unknown, ctx: IValidationContext, pointer: string): value is number {
  return checkNumber(value, ctx, pointer) && (Number.isInteger(value) || raiseInvalid(ctx, pointer));
}

export function checkBoolean(value: unknown, ctx: IValidationContext, pointer: string): value is boolean {
  return checkRequired(value, ctx, pointer) && (typeof value === 'boolean' || raiseIllegalType(ctx, pointer));
}

export function checkEnum(value: unknown, values: Array<string>, ctx: IValidationContext, pointer: string): value is string {
  return checkString(value, ctx, pointer) && (values.includes(value) || raiseInvalid(ctx, pointer));
}
