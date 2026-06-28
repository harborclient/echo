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

### Redirect via `x-redirect-to`

When the `x-redirect-to` header is present on any path except `/health`, the server responds with an HTTP redirect instead of the JSON echo. Supported formats:

| Header value              | Response            |
| ------------------------- | ------------------- |
| `https://example.com`     | 302 redirect to URL |
| `302 https://example.com` | 302 redirect to URL |
| `301 https://example.com` | 301 redirect to URL |

Malformed values return `400` with `{ "error": "Invalid x-redirect-to header" }`. `/health` ignores this header.

```bash
# 302 redirect (default when status omitted)
curl -i -H "x-redirect-to: https://google.com" http://localhost:3000/anything

# Explicit 301
curl -i -H "x-redirect-to: 301 https://google.com" http://localhost:3000/anything
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
docker run --rm -d -p 80:80 -e NGINX_SERVER_NAME=echo.example.com echo
```

### Environment variables

| Variable            | Default | Description                                                      |
| ------------------- | ------- | ---------------------------------------------------------------- |
| `NGINX_SERVER_NAME` | `_`     | Nginx `server_name` value                                        |
| `PORT`              | `3000`  | Internal Node.js listen port (not exposed outside the container) |

## Scripts

| Command       | Description                   |
| ------------- | ----------------------------- |
| `pnpm dev`    | Run with hot reload           |
| `pnpm build`  | Compile TypeScript to `dist/` |
| `pnpm start`  | Run compiled output           |
| `pnpm lint`   | Run ESLint                    |
| `pnpm format` | Format with Prettier          |
