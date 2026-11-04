# QSK Breves Automáticas

Extractor de noticias y gacetillas publicadas por organismos públicos para alimentar secciones informativas de [QSK Noticias](https://qsknoticias.site/).

## Fuentes

El extractor principal combina cuatro fuentes:

| Fuente | Listado |
| --- | --- |
| Gobierno de la Provincia de Buenos Aires | [Gacetillas oficiales](https://www.gba.gob.ar/comunicacion_publica/gacetillas) |
| Municipalidad de Lanús | [Noticias](https://www.lanus.gob.ar/noticias) |
| Municipalidad de Avellaneda | [Noticias](https://www.mda.gob.ar/noticias/) |
| Municipalidad de Esteban Echeverría | [Feed RSS](https://www.estebanecheverria.gob.ar/feed/) |

Se procesan hasta **12 noticias por fuente** en cada extracción. Los registros se identifican por su fuente y se validan contra el dominio de su URL.

El repositorio también incluye un flujo independiente para el feed RSS de [Olé](https://www.ole.com.ar/). Se ejecuta manualmente con `pnpm ole` y genera `data/ole-noticias.json`; no forma parte del workflow automático de gacetillas municipales y provinciales.

## Requisitos

- Node.js 24.
- pnpm 11.28.5 (la versión está declarada en `package.json`).

## Instalación y ejecución local

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm typecheck
pnpm extraer
```

Para procesar un archivo HTML local como entrada, sin consultar Internet ni modificar el historial persistido:

```bash
pnpm extraer ruta/al/listado.html
```

El JSON combinado de salida se guarda en `data/gacetillas.json` (archivo local de trabajo). El historial persistente está en `data/gacetillas-historial.json`.

Para ejecutar el extractor independiente de Olé:

```bash
pnpm ole
```

Su salida se guarda en `data/ole-noticias.json`.

## Historial y actualización automática

El workflow `.github/workflows/actualizar-gacetillas.yml` consulta las cuatro fuentes principales cada 6 horas y también puede ejecutarse manualmente desde **Actions → Actualizar gacetillas oficiales → Run workflow**.

En cada ejecución:

1. Instala dependencias usando el lockfile congelado.
2. Ejecuta tests, lint y typecheck.
3. Descarga y procesa las fuentes disponibles.
4. Deduplica los registros y prioriza las novedades.
5. Completa con noticias anteriores guardadas en `data/gacetillas-historial.json`, respetando el límite de 12 por fuente.
6. Valida el resultado antes de persistir el historial o preparar la actualización de QSK.
7. Si el historial cambió, lo confirma en la rama ejecutada de este repositorio.
8. Crea o actualiza la PR `automation/gacetillas-oficiales` en QSK Noticias solo cuando cambia `src/data/gacetillas.json`.

La extracción conserva las fechas como `null` cuando el listado no las expone; no inventa fechas ni necesita recorrer cada noticia individual.

## Configuración de GitHub Actions

En **Settings → Secrets and variables → Actions** de este repositorio, crear el secret:

- `QSK_NOTICIAS_TOKEN`: fine-grained personal access token limitado al repositorio `AxelQuiroga/QSK-Noticias`, con permiso **Contents: Read and write** y **Pull requests: Read and write**.

El workflow usa el `GITHUB_TOKEN` del propio repositorio para leer el paquete de GHCR y guardar el historial. No guardar tokens en archivos, código ni logs.

Ante errores HTTP, timeout, tests fallidos, un resultado combinado incompleto o URLs inválidas, el workflow valida el estado y evita preparar una PR con datos inválidos. Las fuentes sanas pueden continuar procesándose cuando otra fuente falla, y el job informa el error al finalizar.

## Desarrollo

Los comandos de calidad disponibles son:

- `pnpm test`: pruebas automatizadas.
- `pnpm lint`: análisis estático con ESLint.
- `pnpm typecheck`: comprobación de tipos con TypeScript.

Las dependencias se instalan con `--frozen-lockfile` tanto en Docker como en GitHub Actions para evitar instalaciones que modifiquen silenciosamente el lockfile.
