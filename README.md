# QSK Breves Automáticas

Extractor de gacetillas oficiales del Gobierno de la Provincia de Buenos Aires para alimentar una sección informativa separada en QSK Noticias.

## Ejecución local

```powershell
pnpm install
pnpm test
pnpm typecheck
pnpm extraer
```

También se puede extraer desde un snapshot HTML sin consultar Internet:

```powershell
pnpm extraer data/gacetillas-fuente.html
```

El JSON generado se guarda en `data/gacetillas.json` (archivo local de trabajo).

## Actualización automática

El workflow `.github/workflows/actualizar-gacetillas.yml` consulta el listado oficial cada 6 horas y también puede ejecutarse manualmente desde **Actions → Actualizar gacetillas oficiales → Run workflow**.

Flujo:
1. Instala dependencias y ejecuta tests y typecheck.
2. Hace una única petición al listado oficial.
3. Rechaza respuestas HTTP fallidas y resultados con menos de 10 tarjetas para no preparar una actualización con una extracción incompleta.
4. Conserva como máximo las últimas 12 tarjetas del listado.
5. Compara los datos con QSK Noticias y crea o actualiza una PR en la rama `automation/gacetillas-oficiales` únicamente cuando hay cambios.
6. No publica directamente en `master`: la PR queda para revisión y fusión manual.

No recorre las 165 páginas ni visita cada noticia individual. Extrae título, descripción, URL original, miniatura y volanta cuando están disponibles. La fecha se mantiene como `null` porque no figura en las tarjetas del listado; no se inventan fechas.

### Configuración requerida una sola vez

En **Settings → Secrets and variables → Actions** de este repositorio, crear el secret:

- `QSK_NOTICIAS_TOKEN`: fine-grained personal access token limitado al repositorio `AxelQuiroga/QSK-Noticias`, con permiso **Contents: Read and write** y **Pull requests: Read and write**.

No guardar el token en archivos, código ni logs. Si el secret falta o no tiene permisos, el workflow fallará antes de modificar QSK Noticias.

Ante errores HTTP, timeout, tests fallidos o una extracción con menos de 10 tarjetas, la actualización se detiene y no prepara una PR con datos incompletos.
