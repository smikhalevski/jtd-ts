import JsonPointer from 'json-pointer';
import {IValidationContext, ValidationErrorCode} from './validator-types';

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

/**
 * Returns `true` if consequent checkers should be invoked.
 */
export function isShortCircuit(ctx: IValidationContext): boolean {
  return !(!ctx.shortCircuit || !ctx.errors || ctx.errors.length === 0);
}
