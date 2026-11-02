/**
 * Errores tipados del motor editorial LLM.
 *
 * Cada error lleva un `code` estable para que los callers (CLI, workflows,
 * tests) puedan distinguir causas sin parsear mensajes.
 */
export type EditorialErrorCode =
  | "INVALID_INPUT"
  | "MISSING_DESCRIPTION_FIELD"
  | "INVALID_DESCRIPTION"
  | "PROVIDER_ERROR"
  | "INVALID_PROVIDER_RESPONSE"
  | "VALIDATION_FAILED"
  | "RETRIES_EXHAUSTED";

export class EditorialEngineError extends Error {
  public readonly code: EditorialErrorCode;
  public readonly details?: unknown;

  constructor(code: EditorialErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "EditorialEngineError";
    this.code = code;
    this.details = details;
  }
}

export class ProviderError extends EditorialEngineError {
  public readonly retryable: boolean;
  constructor(message: string, details?: unknown, retryable = true) {
    super("PROVIDER_ERROR", message, details);
    this.name = "ProviderError";
    this.retryable = retryable;
  }
}
