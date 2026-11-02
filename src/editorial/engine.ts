import type { LlmProvider } from "./provider.ts";
import { EditorialEngineError, ProviderError } from "./errors.ts";
import {
  validateInput,
  validateOutput,
  assertPreserved,
} from "./validation.ts";
import { QSK_EDITORIAL_SYSTEM_PROMPT, buildUserContent } from "./prompt.ts";

export interface RewriteOptions {
  provider: LlmProvider;
  /** Largo máximo de la descripción reescrita. Default 280. */
  maxDescriptionLength?: number;
  /** Reintentos acotados ante respuestas inválidas o errores transitorios. Default 2. */
  maxRetries?: number;
  /** Temperatura del modelo. Default 0.2. */
  temperature?: number;
  /** Máximo de tokens de salida. Default 256. */
  maxTokens?: number;
}

export interface RewriteResult {
  /** Campo reescrito. */
  field: string;
  /** Descripción original. */
  originalDescription: string;
  /** Descripción reescrita y validada. */
  description: string;
  /** Objeto de salida: mismo JSON de entrada con solo `field` cambiado. */
  output: Record<string, unknown>;
  /** Intentos realizados (incluye el exitoso). */
  attempts: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractDescription(raw: string, field: string): string {
  const trimmed = raw.trim();
  // Eliminar fences de código si el modelo los incluyó a pesar del prompt.
  const unfenced = trimmed
    .replace(/^```[a-zA-Z]*\n?/, "")
    .replace(/\n?```$/, "")
    .trim();

  // Si devolvió JSON, intentar extraer el campo.
  if (unfenced.startsWith("{") || unfenced.startsWith("[")) {
    try {
      const parsed = JSON.parse(unfenced);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const value = (parsed as Record<string, unknown>)[field];
        if (typeof value === "string") return value;
        // Alias cruzado.
        for (const alias of ["descripcion", "description"]) {
          const v = (parsed as Record<string, unknown>)[alias];
          if (typeof v === "string") return v;
        }
      }
    } catch {
      // Caer al texto plano.
    }
  }
  return unfenced;
}

/**
 * Núcleo del motor: recibe un JSON de noticia extraída y devuelve el mismo
 * JSON con únicamente su descripción reescrita, validada y preservando el
 * resto de los campos byte a byte.
 */
export async function rewriteDescription(
  input: unknown,
  options: RewriteOptions,
): Promise<RewriteResult> {
  if (!options || !options.provider) {
    throw new EditorialEngineError("INVALID_INPUT", "Falta el proveedor LLM (options.provider).");
  }

  const { field: detectedField } = validateInput(input);
  const field = detectedField;
  const record = input as Record<string, unknown>;

  const maxDescriptionLength = options.maxDescriptionLength ?? 280;
  const maxRetries = Math.max(0, options.maxRetries ?? 2);
  const maxAttempts = maxRetries + 1;

  const original = { ...record };
  let attempts = 0;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    attempts = attempt;
    try {
      const raw = await options.provider.complete({
        system: QSK_EDITORIAL_SYSTEM_PROMPT,
        user: buildUserContent(original, field),
        maxTokens: options.maxTokens ?? 256,
        temperature: options.temperature ?? 0.2,
      });

      const extracted = extractDescription(raw, field);
      const validated = validateOutput(extracted, maxDescriptionLength);

      const output: Record<string, unknown> = { ...original, [field]: validated };
      assertPreserved(original, output, field);

      return {
        field,
        originalDescription: record[field] as string,
        description: validated,
        output,
        attempts,
      };
    } catch (error) {
      lastError = error;
      // Errores de validación de entrada no se reintentan.
      if (error instanceof EditorialEngineError && (error.code === "INVALID_INPUT" || error.code === "MISSING_DESCRIPTION_FIELD")) {
        throw error;
      }
      // Errores permanentes del proveedor no se reintentan.
      if (error instanceof ProviderError && !error.retryable) {
        throw error;
      }
      if (attempt < maxAttempts) {
        await sleep(200 * attempt);
        continue;
      }
    }
  }

  if (lastError instanceof EditorialEngineError) {
    throw new EditorialEngineError(
      "RETRIES_EXHAUSTED",
      `Se agotaron los reintentos (${maxAttempts}) sin obtener una descripción válida: ${lastError.message}`,
      lastError,
    );
  }
  throw new EditorialEngineError("RETRIES_EXHAUSTED", "Se agotaron los reintentos sin obtener una descripción válida.", lastError);
}

// Alias para integración con el vocabulario del proyecto.
export const rewriteNoticia = rewriteDescription;
export const runEditorialEngine = rewriteDescription;
