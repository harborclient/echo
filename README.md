# harborclient-echo

An httpbin-style HTTP echo server. Every request (except `/health`) is echoed back as JSON containing the full request snapshot: query args, raw body, parsed JSON, form fields, uploaded files, headers, client IP, and full URL.

Supports GET, POST, PUT, DELETE, and other HTTP methods on any path.

## Local development

```bash
pnpm install
pnpm dev
```

The server listens on port 3000 by default.

```bash
curl http://localhost:3000/health
curl -X POST "http://localhost:3000/post?test=foo" \
  -H "Content-Type: application/json" \
  -d '{"foo":"bar"}'
```

### Redirect via `x-echo-redirect`

When the `x-echo-redirect` header or query param is present on any path except `/health`, the server responds with an HTTP redirect instead of the JSON echo. The header takes precedence when both are set. Supported formats:

| Value                                    | Response            |
| ---------------------------------------- | ------------------- |
| `https://echo.harborclient.com`          | 302 redirect to URL |
| `302 https://echo.harborclient.com`      | 302 redirect to URL |
| `301 https://echo.harborclient.com/path` | 301 redirect to URL |

Redirect destinations are allowlisted. Only these hosts are accepted:

- `https://echo.harborclient.com` (HTTPS only; any path or query)
- `http://localhost` / `https://localhost` (any port or path)
- `http://127.0.0.1` / `https://127.0.0.1` (any port or path)

Malformed values and destinations outside the allowlist return `400` with `{ "error": "Invalid x-echo-redirect header" }`. `/health` ignores this control.

```bash
# 302 redirect (default when status omitted)
curl -i -H "x-echo-redirect: https://echo.harborclient.com" http://localhost:3000/anything

# Explicit 301
curl -i -H "x-echo-redirect: 301 https://echo.harborclient.com/path" http://localhost:3000/anything

# Same via query param (URL-encode spaces in status+URL form)
curl -i "http://localhost:3000/anything?x-echo-redirect=https://echo.harborclient.com"
curl -i "http://localhost:3000/anything?x-echo-redirect=301%20https://echo.harborclient.com/path"
```

### Strict JSON via `x-echo-strict`

By default the echo server accepts any Content-Type. Send `x-echo-strict: json` (header or query param) to require a JSON-compatible media type (`application/json` or any `+json` subtype). The header takes precedence when both are set. Mismatches return `415` with `{ "error": "Unsupported Media Type" }`. Unsupported control values return `400`. `/health` ignores this control.

In HarborClient: add a request header named `x-echo-strict` with value `json`, then send a JSON body with `Content-Type: text/plain` to reproduce a 415.

```bash
# 415 — JSON body labeled as text/plain
curl -i -X POST http://localhost:3000/post \
  -H "Content-Type: text/plain" \
  -H "x-echo-strict: json" \
  -d '{"foo":"bar"}'

# 200 — same body with a JSON Content-Type
curl -i -X POST http://localhost:3000/post \
  -H "Content-Type: application/json" \
  -H "x-echo-strict: json" \
  -d '{"foo":"bar"}'

# Same via query param
curl -i -X POST "http://localhost:3000/post?x-echo-strict=json" \
  -H "Content-Type: text/plain" \
  -d '{"foo":"bar"}'
```

### Delay via `x-echo-delay-ms`

Send `x-echo-delay-ms: <integer>` (header or query param) to pause before responding. The header takes precedence when both are set. Values must be whole milliseconds in `0`–`10000`. Malformed, negative, fractional, or excessive values return `400`. The delay applies before redirects and normal echoes. `/health` ignores this control.

In HarborClient: add a request header named `x-echo-delay-ms` with value `5000`, then inspect the Timing tab — most of the wait should land in Waiting (TTFB).

```bash
curl -i -H "x-echo-delay-ms: 5000" http://localhost:3000/slow

# Same via query param
curl -i "http://localhost:3000/slow?x-echo-delay-ms=4000"
```

### Multipart uploads

`multipart/form-data` requests are parsed with Multer. Non-file fields appear in `form`; uploaded filenames appear in `files` keyed by field name. The raw `data` field is empty for multipart (the body is not retained as a single string).

In HarborClient: set Body to form-data, add a text field and a file field, then inspect the echoed `form` and `files` objects. Sending a manually crafted `Content-Type: multipart/form-data` without a boundary typically yields empty `files`.

```bash
curl -X POST http://localhost:3000/upload \
  -F "note=hello" \
  -F "avatar=@./README.md"
```

## Docker

The Docker image runs Nginx on port 80, reverse-proxying to the Node.js app on an internal port 3000.

### Build

```bash
docker build -t echo .
```

### Run

```bash
docker run --rm -d -p 80:80 echo
```

Then send requests to the mapped host port:

```bash
curl http://localhost:8080/health

curl -X POST "http://localhost:8080/post?test=foo" \
  -H "Content-Type: application/json" \
  -d '{"foo":"bar"}'
```

### Custom server name

Set `NGINX_SERVER_NAME` to control the Nginx `server_name` directive. Defaults to `_` (catch-all):

```bash
docker run --rm -d -p 80:80 -e NGINX_SERVER_NAME=echo.harborclient.com echo
```

### Environment variables

| Variable            | Default | Description                                                      |
| ------------------- | ------- | ---------------------------------------------------------------- |
| `NGINX_SERVER_NAME` | `_`     | Nginx `server_name` value                                        |
| `PORT`              | `3000`  | Internal Node.js listen port (not exposed outside the container) |

## Scripts

| Command             | Description                    |
| ------------------- | ------------------------------ |
| `pnpm dev`          | Run with hot reload            |
| `pnpm build`        | Compile TypeScript to `dist/`  |
| `pnpm start`        | Run compiled output            |
| `pnpm test`         | Run unit and integration tests |
| `pnpm lint`         | Run ESLint                     |
| `pnpm format`       | Format with Prettier           |
| `pnpm format:check` | Check formatting               |
