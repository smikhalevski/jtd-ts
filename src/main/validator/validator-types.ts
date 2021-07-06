export interface IValidationError {
  pointer: string;
  code: string;
}

export type Validator = (value: unknown, errors?: Array<IValidationError>, pointer?: string, excluded?: Array<object>) => Array<IValidationError>;

export type Checker<Output extends Input, Input = unknown> = (value: Input, errors?: Array<IValidationError>, pointer?: string) => value is Output;
