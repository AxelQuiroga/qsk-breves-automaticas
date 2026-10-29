/** Registro tal como se publica en el JSON consumido por QSK Noticias. */
export interface OleNews {
  id: string;
  title: string;
  url: string;
  publishedAt: string | null;
  imageUrl: string | null;
  source: "Olé";
}

/** Campos extraídos del RSS antes de validarlos y normalizarlos. */
export interface NoticiaOleCandidata {
  titulo: string;
  url: string;
  pubDate: string | null;
  imagenUrl: string | null;
}
