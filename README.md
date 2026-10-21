# QSK Breves Automáticas

Extractor de gacetillas oficiales del Gobierno de la Provincia de Buenos Aires para alimentar una sección informativa separada en QSK Noticias.

## Ejecución local

```powershell
pnpm install
pnpm test
pnpm typecheck
pnpm extraer
```

También se puede extraer desde un snapshot HTML sin consultar Internet ni modificar el historial persistido:

```powershell
pnpm extraer data/gacetillas-fuente.html
```

El JSON de salida se guarda en `data/gacetillas.json` (archivo local de trabajo). El historial persistente está en `data/gacetillas-historial.json`.

## Historial y actualización automática

El workflow `.github/workflows/actualizar-gacetillas.yml` consulta el listado oficial cada 6 horas y también puede ejecutarse manualmente desde **Actions → Actualizar gacetillas oficiales → Run workflow**.

En cada ejecución:

1. Ejecuta tests y typecheck.
2. Descarga una única vez el listado oficial.
3. Deduplica por URL y prioriza las gacetillas recién detectadas.
4. Completa con las gacetillas anteriores guardadas en `data/gacetillas-historial.json` hasta alcanzar un máximo de 12.
5. Valida el resultado antes de persistir el historial o preparar la actualización de QSK.
6. Si el historial cambió, lo confirma en `main` de este repositorio para que sobreviva a las siguientes ejecuciones.
7. Crea o actualiza la PR `automation/gacetillas-oficiales` en QSK Noticias solo cuando cambia `src/data/gacetillas.json`.

Por ejemplo, si la fuente devuelve 6 gacetillas nuevas y el historial tiene 12, el resultado contiene esas 6 nuevas y las 6 anteriores más recientes. Si no hay novedades, se conserva el mismo conjunto y no se genera una actualización innecesaria en QSK.

La fecha se mantiene como `null` porque no figura en las tarjetas del listado; no se inventan fechas. No se recorren las 165 páginas ni se visita cada noticia individual.

### Configuración requerida una sola vez

En **Settings → Secrets and variables → Actions** de este repositorio, crear el secret:

- `QSK_NOTICIAS_TOKEN`: fine-grained personal access token limitado al repositorio `AxelQuiroga/QSK-Noticias`, con permiso **Contents: Read and write** y **Pull requests: Read and write**.

El workflow usa el `GITHUB_TOKEN` del propio repositorio para guardar el historial en `main`. No guardar tokens en archivos, código ni logs.

Ante errores HTTP, timeout, tests fallidos, un resultado combinado con menos de 10 tarjetas o URLs inválidas, la actualización se detiene y no prepara una PR con datos incompletos.
