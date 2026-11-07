# Networking, TLS and HTTP Troubleshooting

This document describes networking issues encountered by the project when accessing external sources from GitHub Actions, the investigation process, and the solutions adopted.

It covers TLS certificate validation, HTTP 403 responses, and differences between local environments and GitHub-hosted runners.

## 1. Context

The project retrieves content from external sources, including official government websites and the Olé RSS feed.

Although requests may work correctly from a local development environment, they can behave differently when executed from GitHub Actions due to differences in:

- Network infrastructure and IP reputation.
- TLS certificate stores and trust configuration.
- HTTP client and TLS implementation.
- Server-side anti-bot and request filtering mechanisms.
- CDN and Cloudflare security policies.

These differences must be considered when designing reliable extraction workflows.

## 2. TLS and SSL certificate validation

### 2.1. SSL vs. TLS

SSL (Secure Sockets Layer) is deprecated. Modern HTTPS connections use TLS (Transport Layer Security).

In this document, SSL is mentioned only as a commonly used historical term. The technical solutions described here concern TLS.

### 2.2. Node.js certificate trust

One of the issues investigated involved differences in certificate trust between local environments and GitHub Actions.

Node.js does not necessarily use the same certificate authorities as the operating system by default.

For environments where system certificate authorities are required, the project uses:

```bash
node --use-system-ca
```

This allows Node.js to include the operating system's trusted certificate authorities when validating TLS connections.

The flag is used in the relevant execution commands, including:

```json
{
  "scripts": {
    "extraer": "node --use-system-ca src/index.ts",
    "ole": "node --use-system-ca src/ole/run.ts"
  }
}
```

**Important:** `--use-system-ca` does not disable certificate validation. It changes the certificate authorities available to Node.js for trust verification.

Never solve certificate problems by disabling TLS verification, using `NODE_TLS_REJECT_UNAUTHORIZED=0`, or accepting invalid certificates.

## 3. HTTP 403 and server-side request filtering

### 3.1. Understanding HTTP 403

An HTTP 403 Forbidden response means the server understood the request but refused to authorize it.

This does not necessarily indicate an authentication problem.

Possible causes include:

- CDN or Cloudflare security rules.
- IP reputation or hosting-provider restrictions.
- Anti-bot protection.
- Request headers or TLS fingerprints that trigger filtering.
- Restrictions applied specifically to automated clients.

A request that works from a local browser may fail from a GitHub Actions runner.

### 3.2. Lanús: restricted HTTP requests

During the integration of the Lanús source, requests from GitHub Actions encountered HTTP 403 responses.

The investigation considered differences between ordinary HTTP clients and browser-like clients.

A fallback based on `curl-impersonate` was introduced for this source.

The intended behavior is:

1. Attempt the normal HTTP request.
2. Detect an HTTP 403 response.
3. Use the configured fallback client when appropriate.
4. Preserve the normal extraction and validation flow.
5. Report failures instead of silently accepting incomplete data.

The fallback is source-specific. It must not change the behavior of unrelated extractors.

The workflow downloads a pinned `curl-impersonate` release and verifies its SHA-256 checksum before execution.

This verification helps ensure that the downloaded archive matches the expected artifact.

**Security consideration:** a browser-like request does not grant permission to bypass access controls. If a source explicitly blocks automated access, its terms and restrictions must be respected.

## 4. Olé: RSS access and TLS investigation

The Olé RSS integration required separate investigation because its behavior was not necessarily equivalent to the official government sources.

The investigation involved:

- Testing RSS access from GitHub Actions.
- Comparing local and hosted execution environments.
- Inspecting HTTP responses and connection failures.
- Reviewing TLS certificate validation.
- Verifying the RSS response before generating the output JSON.

The production workflow now performs the extraction and validates the generated feed before attempting to publish it to QSK Noticias.

The diagnostic workflow used during investigation was temporary and should not be considered a production dependency.

The permanent implementation belongs in the extractor, its tests, and the production workflow.

## 5. Reliability and error handling

Networking failures must not result in corrupted or incomplete published data.

The extraction process should follow these principles:

- Use explicit request timeouts.
- Distinguish HTTP errors from network and TLS errors.
- Avoid silently swallowing exceptions.
- Validate external responses before processing them.
- Validate generated JSON before publication.
- Preserve previously valid data when a source fails.
- Report source-specific failures in workflow logs.
- Avoid retrying permanent errors indefinitely.

A failure in one source should not unnecessarily invalidate data successfully retrieved from other sources, provided the resulting output passes the project's validation rules.

## 6. GitHub Actions considerations

GitHub-hosted runners are not equivalent to local development machines.

When investigating networking issues, consider:

| Area | What to inspect |
|---|---|
| Node.js | Runtime version and TLS behavior |
| Certificate store | System and Node.js trusted CAs |
| HTTP client | Headers, timeout and redirect handling |
| Network | DNS resolution and connection failures |
| HTTP response | Status code and response headers |
| CDN | Possible filtering or security challenges |
| Dependencies | Version consistency and reproducibility |

Temporary diagnostic workflows can be useful during investigation, but they should not remain in the production workflow directory once their purpose has ended.

Permanent CI should validate the code, tests, types and linting. Production workflows should focus on extraction and publication.

## 7. Security guidelines

Never commit or expose:

- Personal access tokens.
- GitHub Actions secrets.
- Authentication cookies.
- Private request headers.
- Credentials embedded in URLs.
- Unredacted environment variables.
- Sensitive network or infrastructure information.

Additional recommendations:

- Keep GitHub Actions permissions restricted to the minimum required.
- Pin external dependencies and verify downloaded binaries.
- Never disable TLS certificate verification to make a request succeed.
- Do not publish diagnostic logs containing credentials or sensitive headers.
- Respect the access policies of external sources.

## 8. Lessons learned

The main lessons from these investigations are:

1. A successful local request does not guarantee success from GitHub Actions.
2. TLS certificate trust and HTTP authorization are different problems and must be investigated separately.
3. HTTP 403 responses should not automatically be treated as transient network failures.
4. Source-specific workarounds should remain isolated from the rest of the extraction system.
5. External responses must be validated before they can affect persistent data.
6. Temporary diagnostics should be removed after investigation, while the technical knowledge should remain documented.

The goal is not to make every external request succeed at any cost. The goal is to build an extractor that behaves predictably, fails safely, and makes its failures observable.

---

*This document describes the engineering decisions and troubleshooting knowledge accumulated during the development of QSK Breves Automáticas. Implementation details should be kept synchronized with the actual production code and workflows.*