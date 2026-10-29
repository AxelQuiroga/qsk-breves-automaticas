export type CategoriaErrorOle =
  | "red"
  | "acceso-denegado"
  | "http"
  | "respuesta-invalida"
  | "xml-invalido"
  | "feed-vacio"
  | "normalizacion";

/** Error estable para distinguir fallas del feed sin analizar mensajes libres. */
export class ErrorOleFeed extends Error {
  readonly categoria: CategoriaErrorOle;
  readonly status: number | null;

  constructor(
    mensaje: string,
    categoria: CategoriaErrorOle,
    status: number | null = null,
    options?: ErrorOptions,
  ) {
    super(mensaje, options);
    this.name = "ErrorOleFeed";
    this.categoria = categoria;
    this.status = status;
  }
}
