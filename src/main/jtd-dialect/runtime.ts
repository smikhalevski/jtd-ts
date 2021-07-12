import {IValidationContext, ValidationErrorCode} from './runtime-types';

export * from './runtime-types';

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
 * Returns `true` if further validation must be prevented.
 */
export function isValidationCompleted(ctx: IValidationContext): boolean {
  return !(!ctx.shallow || !ctx.errors || ctx.errors.length === 0);
}

export function escapeJsonPointer(str: string | number): string {
  return str.toString().replace(/~/g, '~0').replace(/\//g, '~1');
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
