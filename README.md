# OCI Visualizer

A self-hosted web app for exploring Oracle Cloud Infrastructure environments. Point an export script at your tenancy, upload the result, and get topology maps, a resource inventory, security audit, tag compliance, reachability analysis, and snapshot diffs.

![Node](https://img.shields.io/badge/node-20%2B-43853d) ![License](https://img.shields.io/badge/license-MIT-blue)

## Quick start

**Docker (recommended):**

```bash
git clone <repo-url> && cd oci-visualizer
./scripts/setup.sh              # writes .env with random JWT + DB secrets
docker compose up -d --build
```

Open <https://localhost:4000> and register the first user — they're auto-approved as admin.

**Bare metal:**

```bash
git clone <repo-url> && cd oci-visualizer
./scripts/setup.sh
npm install
npx prisma migrate deploy --schema server/prisma/schema.prisma
npm run build
npm start
```

## Getting your data in

Export from OCI with the bundled script (requires `oci` CLI and `jq`):

```bash
./scripts/generate-oci-export.sh -c <COMPARTMENT_OCID>
```

Then zip the output directory and upload it via the **Import** page. That's it.

## Updating

```bash
git pull
docker compose up -d --build        # Docker
# — or —
npm run deploy                       # bare-metal via PM2
```

## Configuration

All config lives in `.env` at the repo root. `setup.sh` generates one with sensible defaults; edit it for anything else.

| Key | Default | Notes |
|---|---|---|
| `JWT_SECRET` | *(random)* | Must be ≥32 chars in production. |
| `DATABASE_URL` | *(postgres)* | Postgres URL. Required in production. |
| `CORS_ORIGINS` | `https://localhost:4000` | Comma-separated. Set to your real frontend URL. |
| `TLS_ENABLED` | `true` | Self-signed cert auto-generated if no paths set. |
| `TLS_CERT` / `TLS_KEY` | *(empty)* | Paths to your own cert/key. |
| `MAX_UPLOAD_SIZE_MB` | `500` | Upload cap. |

## Development

```bash
npm install
npm run dev      # client on :5173, server on :4000 with hot reload
npm test         # vitest
```

## License

MIT — see [LICENSE](LICENSE).
