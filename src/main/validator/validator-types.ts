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
  excludedValues?: Array<unknown>;

  /**
   * If set to `true` then validators and checkers should not check a passed value if there are any errors in the
   * context already. This would cause only the first error to be captured.
   */
  shortCircuit?: boolean;
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
