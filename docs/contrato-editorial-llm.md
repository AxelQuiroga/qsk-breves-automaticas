# Motor LLM editorial para QSK Breves Automáticas

## Contrato de entrada/salida

### Entrada

Un objeto JSON que represente una noticia extraída. Debe contener al menos uno de estos campos:

- `descripcion` (convención del extractor, español)
- `description` (alias soportado)

El valor debe ser un string no vacío. Los demás campos se preservan exactamente.

Ejemplo de entrada: `examples/entrada.sample.json`.

### Salida

El mismo objeto JSON de entrada, con únicamente el campo de descripción reescrito. Ningún otro campo se agrega, elimina ni modifica.

Ejemplo de salida: `examples/salida.sample.json`.

### Ambigüedad de campos

Si el JSON contiene `descripcion` y `description` simultáneamente, el motor rechaza
la entrada (`INVALID_INPUT`) por ambigüedad. Solo se admite uno de los dos.

- La entrada debe ser un objeto JSON (no array ni null).
- El campo de descripción debe existir y ser un string no vacío (máximo 4000 caracteres).
- La respuesta del proveedor se limpia y valida: no vacía, máximo configurable (default 280), sin JSON/Markdown suelto.
- Se verifica que todos los demás campos permanezcan intactos (`assertPreserved`).
- Si el proveedor falla o devuelve una respuesta inválida, se reintenta hasta `maxRetries` (default 2) y finalmente se lanza `EditorialEngineError` con código `RETRIES_EXHAUSTED`.

### Descripciones nulas o vacías

El motor **no puede reescribir** descripciones nulas o vacías: `validateInput` lanza
`INVALID_INPUT`. Para la futura integración por lotes, usar `isRewritable()` para
omitir esas noticias sin fallar la corrida; la descripción original se conserva
tal cual.

Interfaz `LlmProvider` en `src/editorial/provider.ts`. Implementación concreta: `CloudflareWorkersAiProvider` (Cloudflare Workers AI, modelo por defecto `@cf/zai-org/glm-4.7-flash`).

Configuración requerida (variables de entorno, sin exponer secretos):

- `CLOUDFLARE_API_TOKEN`: token de Cloudflare con permisos de Workers AI.
- `CLOUDFLARE_ACCOUNT_ID`: ID de cuenta de Cloudflare.

Opcionales:

- `EDITORIAL_MAX_DESCRIPTION_LENGTH` (default 280) — a nivel de código vía `RewriteOptions.maxDescriptionLength`.

### Uso programático

```ts
import { rewriteDescription, CloudflareWorkersAiProvider } from "./src/editorial/index.ts";

const provider = new CloudflareWorkersAiProvider(); // lee env
const result = await rewriteDescription(inputJson, { provider });
console.log(result.output); // JSON con description reescrita
```

### Pruebas

- `tests/editorial/engine.test.ts`: contrato, preservación de metadatos, fallos del proveedor, reintentos.
- Proveedor simulado (mock) para no depender de red ni credenciales.
