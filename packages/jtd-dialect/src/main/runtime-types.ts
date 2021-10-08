/**
 * The context object that is passed to validators.
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
  excluded?: Set<unknown>;

  /**
   * If set to `true` then validators don't validate a passed value if there are any errors in the context already.
   * This would cause only the first error to be captured.
   */
  shallow?: boolean;
}

export const enum ValidationErrorCode {
  REQUIRED = 'required',
  ILLEGAL_TYPE = 'illegalType',
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
 * The validator is the function that ensures that that `value` is conforms the JTD.
 */
export interface Validator {

  /**
   * Validate the value.
   *
   * @param value The validated value.
   * @param ctx The context that holds errors and may be populated during validation.
   * @param pointer JSON pointer of the validated value.
   * @returns The list errors of errors or `undefined` if there were no errors.
   */
  (value: unknown, ctx?: IValidationContext, pointer?: string): Array<IValidationError> | undefined;

  /**
   * The cache object populated by the validator during execution.
   */
  cache?: Record<string, any>;
}
