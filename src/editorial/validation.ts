import { EditorialEngineError } from "./errors.ts";

export const DEFAULT_MAX_DESCRIPTION_LENGTH = 280;
export const DEFAULT_MIN_DESCRIPTION_LENGTH = 1;

export const DESCRIPTION_FIELD_CANDIDATES = ["descripcion", "description"] as const;

export function detectDescriptionField(input: Record<string, unknown>): string {
  const hasEs = Object.prototype.hasOwnProperty.call(input, "descripcion");
  const hasEn = Object.prototype.hasOwnProperty.call(input, "description");
  if (hasEs && hasEn) {
    throw new EditorialEngineError(
      "INVALID_INPUT",
      "Ambigüedad: el JSON contiene 'descripcion' y 'description' simultáneamente. El motor no puede decidir cuál reescribir.",
    );
  }
  if (hasEs) return "descripcion";
  if (hasEn) return "description";
  throw new EditorialEngineError(
    "MISSING_DESCRIPTION_FIELD",
    "El JSON de entrada no contiene un campo 'descripcion' ni 'description'.",
  );
}

/**
 * Indica si una entrada es reescribible por el motor (tiene descripción no vacía).
 * Útil para la futura integración por lotes: las noticias con descripción nula
 * o vacía se omiten sin fallar la corrida.
 */
export function isRewritable(input: unknown): boolean {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return false;
  const record = input as Record<string, unknown>;
  try {
    const field = detectDescriptionField(record);
    const value = record[field];
    return typeof value === "string" && value.trim().length > 0;
  } catch {
    return false;
  }
}

export function validateInput(input: unknown): { field: string; value: string } {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new EditorialEngineError("INVALID_INPUT", "La entrada debe ser un objeto JSON (noticia).");
  }
  const record = input as Record<string, unknown>;
  const field = detectDescriptionField(record);
  const value = record[field];
  if (typeof value !== "string") {
    throw new EditorialEngineError(
      "INVALID_INPUT",
      `El campo '${field}' debe ser un string (puede ser vacío solo si se permite reescribir).`,
    );
  }
  if (value.trim().length === 0) {
    throw new EditorialEngineError("INVALID_INPUT", `El campo '${field}' está vacío; no hay descripción para reescribir.`);
  }
  if (value.length > 4000) {
    throw new EditorialEngineError("INVALID_INPUT", `El campo '${field}' supera el límite de entrada (4000 caracteres).`);
  }
  return { field, value };
}

export function validateOutput(
  candidate: string,
  maxLength: number = DEFAULT_MAX_DESCRIPTION_LENGTH,
): string {
  const cleaned = candidate.trim().replace(/^["'`]+|["'`]+$/g, "").trim();
  if (cleaned.length < DEFAULT_MIN_DESCRIPTION_LENGTH) {
    throw new EditorialEngineError("INVALID_PROVIDER_RESPONSE", "La respuesta del proveedor está vacía.");
  }
  if (cleaned.length > maxLength) {
    throw new EditorialEngineError(
      "INVALID_PROVIDER_RESPONSE",
      `La descripción reescrita supera el máximo permitido (${maxLength} caracteres).`,
    );
  }
  // Rechazar respuestas que parezcan JSON o Markdown (contrato: texto plano).
  if (cleaned.startsWith("{") || cleaned.startsWith("[") || cleaned.startsWith("```")) {
    throw new EditorialEngineError(
      "INVALID_PROVIDER_RESPONSE",
      "La respuesta del proveedor no es texto plano de descripción.",
    );
  }
  return cleaned;
}

export function assertPreserved(
  original: Record<string, unknown>,
  rewritten: Record<string, unknown>,
  field: string,
): void {
  for (const key of Object.keys(original)) {
    if (key === field) continue;
    if (!Object.prototype.hasOwnProperty.call(rewritten, key)) {
      throw new EditorialEngineError("VALIDATION_FAILED", `Falta el campo preservado '${key}' en la salida.`);
    }
    if (!deepEqual(original[key], rewritten[key])) {
      throw new EditorialEngineError("VALIDATION_FAILED", `El campo '${key}' fue alterado por el motor.`);
    }
  }
  for (const key of Object.keys(rewritten)) {
    if (key === field) continue;
    if (!Object.prototype.hasOwnProperty.call(original, key)) {
      throw new EditorialEngineError("VALIDATION_FAILED", `Se agregó un campo no permitido: '${key}'.`);
    }
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== "object") return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, (b as unknown[])[i]));
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const keysA = Object.keys(ao);
  const keysB = Object.keys(bo);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k) => Object.prototype.hasOwnProperty.call(bo, k) && deepEqual(ao[k], bo[k]));
}
