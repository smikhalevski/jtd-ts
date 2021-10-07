import {IValidationContext, ValidationErrorCode} from './runtime-types';

/**
 * RegExp to validate an RFC3339 timestamp.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc3339#section-5.6 Internet Date/Time Format
 * @example
 * "1985-04-12T23:20:50.52Z"
 */
const datePattern = /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;

export function isNotNullable(value: unknown): boolean {
  return value !== null;
}

export function isNotOptional(value: unknown): boolean {
  return value !== undefined;
}

export function getObjectKeys(value: object): Array<string> {
  return Object.keys(value);
}

/**
 * Returns `true` if further validation must be prevented.
 */
export function isValidationCompleted(ctx: IValidationContext): boolean {
  return !(!ctx.shallow || !ctx.errors || ctx.errors.length === 0);
}

export function raiseValidationError(code: string | number, ctx: IValidationContext, pointer: string): false {
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

/**
 * Returns `false` if value is excluded from validation.
 */
export function rejectExcluded(value: unknown, ctx: IValidationContext): boolean {
  const excluded = ctx.excluded ||= new Set();

  if (excluded.has(value)) {
    return false;
  }
  excluded.add(value);
  return true;
}

export function checkRequired(value: unknown, ctx: IValidationContext, pointer: string): value is {} {
  return !isValidationCompleted(ctx) && (value != null || raiseValidationError(ValidationErrorCode.REQUIRED, ctx, pointer));
}

export function checkArray(value: unknown, ctx: IValidationContext, pointer: string): value is Array<unknown> {
  return checkRequired(value, ctx, pointer) && (Array.isArray(value) || raiseIllegalType(ctx, pointer)) && rejectExcluded(value, ctx);
}

export function checkObject(value: unknown, ctx: IValidationContext, pointer: string): value is Record<string, unknown> {
  return checkRequired(value, ctx, pointer) && (typeof value === 'object' || raiseIllegalType(ctx, pointer)) && rejectExcluded(value, ctx);
}

export function checkString(value: unknown, ctx: IValidationContext, pointer: string): value is string {
  return checkRequired(value, ctx, pointer) && (typeof value === 'string' || raiseIllegalType(ctx, pointer));
}

export function checkTimestamp(value: unknown, ctx: IValidationContext, pointer: string): value is string {
  return checkString(value, ctx, pointer) && (datePattern.exec(value) !== null || raiseInvalid(ctx, pointer));
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
