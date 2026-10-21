# QSK Breves Automáticas

## Objetivo

Extraer las gacetillas visibles del listado oficial del Gobierno de la Provincia de Buenos Aires:

https://www.gba.gob.ar/comunicacion_publica/gacetillas

El resultado alimenta una sección separada de QSK Noticias para mostrar título, bajada, imagen, volanta y enlace a la publicación oficial. No son artículos editoriales propios ni se agregan a la colección editorial de noticias.

## Alcance

- Extraer las tarjetas del listado; no visitar páginas individuales.
- Consultar el listado como máximo una vez por ejecución.
- Conservar título, descripción, imagen, URL original, fecha solo si está disponible y volanta/localidad cuando exista.
- La fecha se mantiene como null si no aparece en las tarjetas.
- Normalizar espacios, resolver URLs relativas y deduplicar por URL.
- Mantener un JSON local en data/gacetillas.json para desarrollo y verificación.
- El workflow programado publica el JSON en src/data/gacetillas.json del repositorio AxelQuiroga/QSK-Noticias; el cambio dispara el build normal del sitio.
- No crear borradores ni publicar artículos dentro de src/content/noticias.
- No incorporar IA, base de datos ni dependencias innecesarias.

## Automatización

El workflow .github/workflows/actualizar-gacetillas.yml se ejecuta cada seis horas y también permite ejecución manual. Antes de actualizar QSK, ejecuta los tests, el typecheck y valida que haya al menos 10 tarjetas. Si la fuente falla o la extracción parece incompleta, no modifica el JSON de QSK.

Requiere el secret QSK_NOTICIAS_TOKEN, un fine-grained token limitado al repositorio AxelQuiroga/QSK-Noticias con permiso Contents: Read and write. Nunca incluir tokens en el repositorio.

## Tecnologías

- Node.js 24.
- TypeScript estricto.
- pnpm.
- Cheerio para analizar HTML.
- Vitest para tests.
- ESLint para análisis estático.

## Tests y verificación

- Los tests deben usar tests/fixtures/; nunca dependen de Internet.
- Cubrir tarjetas completas, campos opcionales, URLs relativas, duplicados, HTML vacío y cambios de estructura.
- Ejecutar pnpm test y pnpm typecheck.
- El lint tiene una incompatibilidad conocida entre typescript-eslint@8.72 y TypeScript 7; no bloquear la automatización por ese lint hasta resolver la incompatibilidad deliberadamente.

## Comandos

```powershell
pnpm install
pnpm test
pnpm typecheck
pnpm extraer
pnpm extraer data/gacetillas-fuente.html
```
