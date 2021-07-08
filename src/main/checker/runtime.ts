import {
  isValidationCompleted,
  IValidationContext,
  raiseIllegalType,
  raiseInvalid,
  raiseValidationError,
  ValidationErrorCode,
} from '../validator/runtime';

export const enum CheckerRuntimeKey {
  OBJECT = 'o',
  ARRAY = 'a',
  ENUM = 'e',
  BOOLEAN = 'b',
  STRING = 's',
  NUMBER = 'n',
  INTEGER = 'i',
}

export default {
  [CheckerRuntimeKey.OBJECT]: checkObject,
  [CheckerRuntimeKey.ARRAY]: checkArray,
  [CheckerRuntimeKey.ENUM]: checkEnum,
  [CheckerRuntimeKey.BOOLEAN]: checkBoolean,
  [CheckerRuntimeKey.STRING]: checkString,
  [CheckerRuntimeKey.NUMBER]: checkNumber,
  [CheckerRuntimeKey.INTEGER]: checkInteger,
};

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
