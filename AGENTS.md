# QSK Breves Automáticas

## Objetivo

Crear un extractor pequeño que obtenga las tarjetas visibles de la página oficial de gacetillas del Gobierno de la Provincia de Buenos Aires:

https://www.gba.gob.ar/comunicacion_publica/gacetillas

El resultado de esta primera etapa es un JSON local de prueba con los datos recuperados de cada tarjeta.

## Alcance actual

Extraer, cuando estén disponibles:

- Título.
- Descripción breve.
- URL de la imagen en miniatura.
- URL absoluta de la noticia original.
- Fecha, si la tarjeta la proporciona.
- Localidad o etiqueta geográfica, si existe.

No entrar en las páginas individuales de las noticias.

No publicar artículos en QSK Noticias. No modificar el repositorio QSK Noticias ni `extraccion-ultimate`.

## Tecnologías

- Node.js 24.
- TypeScript estricto.
- pnpm.
- Cheerio para analizar HTML.
- Vitest para tests.
- ESLint para análisis estático.

## Criterios de calidad

- Mantener una implementación pequeña y fácil de entender.
- No inventar campos ni valores ausentes.
- Resolver correctamente las URL relativas.
- Distinguir entre una imagen ausente y una extracción fallida.
- Evitar duplicados usando la URL normalizada de cada noticia.
- Manejar errores de red, respuestas HTTP no exitosas y HTML inesperado.
- Usar timeouts razonables al consultar la fuente.
- No incorporar dependencias innecesarias.
- No agregar IA ni base de datos.
- No modificar archivos fuera de este repositorio.

## Tests

Probar tarjetas completas, campos opcionales, URL relativas, duplicados, HTML vacío y cambios inesperados en la estructura.

Usar HTML de prueba local en `tests/fixtures/`. Los tests no deben depender de Internet.

## Entrega

Antes de terminar, ejecutar los tests, el build y el lint. Documentar cómo ejecutar el extractor y dónde se guarda el JSON.

Informar cuántas tarjetas se detectaron y cuántas contienen título, descripción, imagen y URL válida. No afirmar que la extracción funciona correctamente si no se ha ejecutado contra la página real.

No implementar publicación automática en esta etapa.