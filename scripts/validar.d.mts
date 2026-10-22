/**
 * Declaración de tipos para el módulo de validación del workflow
 * (`scripts/validar.mjs`). La lógica vive en JS puro para correr con
 * node desnudo en CI; este archivo solo tipa lo que consumen los tests.
 */
declare function validarDataset(
  noticias: unknown,
  previas?: Array<{ urlNoticia: string; fuente?: string }>,
): { total: number; porFuente: Record<string, number> };

declare function main(): void;

export { validarDataset, main };
