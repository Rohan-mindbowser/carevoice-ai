/** Any failure talking to the LLM provider. */
export class LlmError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'LlmError';
  }
}

/** The model produced output that could not be validated against the expected schema. */
export class LlmValidationError extends LlmError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'LlmValidationError';
  }
}
