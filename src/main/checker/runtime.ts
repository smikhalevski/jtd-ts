import {IValidationContext, ValidationErrorCode} from '../validator/validator-types';
import {isShortCircuit, raiseIllegalType, raiseInvalid, raiseValidationError} from '../validator/runtime';

export const enum CheckerName {
  OBJECT = 'o',
  ARRAY = 'a',
  ENUM = 'e',
  BOOLEAN = 'b',
  STRING = 's',
  NUMBER = 'n',
  INTEGER = 'i',
}

export default {
  [CheckerName.OBJECT]: checkObject,
  [CheckerName.ARRAY]: checkArray,
  [CheckerName.ENUM]: checkEnum,
  [CheckerName.BOOLEAN]: checkBoolean,
  [CheckerName.STRING]: checkString,
  [CheckerName.NUMBER]: checkNumber,
  [CheckerName.INTEGER]: checkInteger,
};

function exclude(value: unknown, ctx: IValidationContext) {

}

function checkRequired(value: unknown, ctx: IValidationContext, pointer: string): value is {} {
  return !isShortCircuit(ctx) && (value != null || raiseValidationError(ValidationErrorCode.REQUIRED, ctx, pointer));
}

function checkArray(value: unknown, ctx: IValidationContext, pointer: string): value is Array<unknown> {
  return checkRequired(value, ctx, pointer) && (Array.isArray(value) || raiseIllegalType(ctx, pointer));
}

function checkObject(value: unknown, ctx: IValidationContext, pointer: string): value is Record<string, unknown> {
  return checkRequired(value, ctx, pointer) && (typeof value === 'object' || raiseIllegalType(ctx, pointer));
}

function checkString(value: unknown, ctx: IValidationContext, pointer: string): value is string {
  return checkRequired(value, ctx, pointer) && (typeof value === 'string' || raiseIllegalType(ctx, pointer));
}

function checkNumber(value: unknown, ctx: IValidationContext, pointer: string): value is number {
  return checkRequired(value, ctx, pointer) && (Number.isFinite(value) || raiseIllegalType(ctx, pointer));
}

function checkInteger(value: unknown, ctx: IValidationContext, pointer: string): value is number {
  return checkNumber(value, ctx, pointer) && (Number.isInteger(value) || raiseInvalid(ctx, pointer));
}

function checkBoolean(value: unknown, ctx: IValidationContext, pointer: string): value is boolean {
  return checkRequired(value, ctx, pointer) && (typeof value === 'boolean' || raiseIllegalType(ctx, pointer));
}

function checkEnum(value: unknown, values: Array<string>, ctx: IValidationContext, pointer: string): value is string {
  return checkString(value, ctx, pointer) && (values.includes(value) || raiseInvalid(ctx, pointer));
}
