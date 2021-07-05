export const enum ValidationErrorCode {
  REQUIRED = 'required',
  ILLEGAL_TYPE = 'illegal_type',
  INVALID = 'invalid',
}

export interface IValidationError {
  pointer: string;
  code: ValidationErrorCode | string;
}

export type Validator = (value: unknown, errors?: Array<IValidationError>, pointer?: string) => Array<IValidationError>;

export type Checker<Output extends Input, Input = unknown> = (value: Input, errors?: Array<IValidationError>, pointer?: string) => value is Output;
