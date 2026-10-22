/**
 * Normalización de fechas de las fuentes a ISO `YYYY-MM-DD`.
 *
 * Las fechas del listado de Lanús (`dd/MM/yyyy`) y de Avellaneda
 * (`Mié 21 Oct 2026`) no tienen hora, así que se construye el ISO
 * directamente desde sus componentes, sin depender de la zona horaria.
 * Los feeds RSS traen `pubDate` RFC-822 con hora en UTC: para no perder
 * el día cuando el post se publicó cerca de medianoche UTC, se convierte
 * a la zona horaria de la fuente (`America/Argentina/Buenos_Aires`).
 */
const ZONA_POR_DEFECTO = "America/Argentina/Buenos_Aires";

export function aFechaISOLocal(
  valor: string | null | undefined,
  zona: string = ZONA_POR_DEFECTO,
): string | null {
  if (!valor) return null;
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return null;
  const formato = new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formato.format(fecha);
}

/** `dd/MM/yyyy` (como muestra el listado de Lanús) → `YYYY-MM-DD`. Devuelve `null` si no matchea. */
export function deDiaMesAnioAISO(texto: string): string | null {
  const match = texto.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  const dia = match?.[1];
  const mes = match?.[2];
  const anio = match?.[3];
  if (!dia || !mes || !anio) return null;
  const mesNum = Number.parseInt(mes, 10);
  const diaNum = Number.parseInt(dia, 10);
  if (mesNum < 1 || mesNum > 12 || diaNum < 1 || diaNum > 31) return null;
  return `${anio}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
}
