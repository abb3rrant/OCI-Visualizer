# OCI Visualizer

A full-stack web application for visualizing, auditing, and analyzing Oracle Cloud Infrastructure (OCI) environments. Import your OCI resource data and explore it through interactive topology maps, security audits, reachability analysis, and more.

## Features

- **Interactive Topology** -- Network, compartment, and dependency views powered by React Flow with ELK layout engine. Export as PNG.
- **Security Audit** -- Automated findings across 8+ categories (public buckets, open security lists, unencrypted volumes, broad IAM policies, etc.) with CIS benchmark mapping.
- **Reachability Analysis** -- Trace network paths between IPs through gateways, route tables, security lists, and NSGs. Supports fan-out (from source) and fan-in (to destination) modes.
- **Resource Inventory** -- Paginated, filterable table of all imported resources with full-text search.
- **Snapshot Diff** -- Compare two snapshots side-by-side to see added, removed, and changed resources with field-level diffs.
- **Tag Compliance** -- Check coverage of required tags across resources and export non-compliant lists.
- **Audit Trend** -- Track security posture over time across multiple snapshots with a line chart.
- **Snapshot Export/Import** -- Back up and restore complete snapshots as JSON bundles.
- **Dark Mode** -- Full dark theme with system preference detection and manual toggle.
- **TLS by Default** -- Auto-generated self-signed certificates, or bring your own.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS v4, urql (GraphQL), React Flow |
| Backend | Node.js, GraphQL Yoga, Prisma ORM |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Auth | JWT with bcrypt password hashing |
| Layout | ELK.js for topology graph layout |

## Quick Start

### Prerequisites

- Node.js 20+
- npm 9+
- OpenSSL (for auto-generated TLS certs; optional -- falls back to HTTP if unavailable)

### Install and Run

```bash
git clone <repo-url> && cd oci-visualizer
npm install
npx prisma migrate dev --schema=server/prisma/schema.prisma
npm run dev
```

The server starts at `https://localhost:4000` and the client dev server at `http://localhost:5173` (proxies API requests to the backend).

Register a user at the login screen, create a snapshot, then import your OCI export data.

## Exporting from OCI

An export script is included that uses the OCI CLI to dump all supported resource types:

```bash
# Single compartment
./scripts/generate-oci-export.sh -c <COMPARTMENT_OCID>

# Multiple compartments from a file (one OCID per line)
./scripts/generate-oci-export.sh -f compartments.txt

# Specify region and output directory
./scripts/generate-oci-export.sh -c <COMPARTMENT_OCID> -r us-ashburn-1 -o ./my-export
```

The script is also available for download from the running app at `GET /api/export-script`.

Prerequisites: [OCI CLI](https://docs.oracle.com/en-us/iaas/Content/API/Concepts/cliconcepts.htm) installed and configured, `jq` installed.

Upload the resulting directory as a ZIP (or individual JSON files) through the Import page.

## Environment Variables

Create or edit `server/.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `file:./prisma/dev.db` | Database connection string. Use `postgresql://...` for Postgres. |
| `JWT_SECRET` | `change-me` | JWT signing secret. **Must change in production.** |
| `PORT` | `4000` | Server listen port |
| `TLS_ENABLED` | `true` | Enable HTTPS. Set to `false` for plain HTTP. |
| `TLS_CERT` | *(empty)* | Path to your TLS certificate PEM file |
| `TLS_KEY` | *(empty)* | Path to your TLS private key PEM file |
| `MAX_UPLOAD_SIZE_MB` | `100` | Maximum upload file size in megabytes |
| `CORS_ORIGINS` | `http(s)://localhost:5173,4000` | Comma-separated allowed CORS origins |
| `NODE_ENV` | `development` | Set to `production` to serve the built client |

Client-side (optional, used by Vite dev proxy):

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `https://localhost:4000` | Backend URL for Vite dev proxy |

## TLS

TLS is enabled by default. On first startup the server auto-generates a self-signed certificate in `certs/` using OpenSSL (valid 365 days, CN=localhost with SAN for localhost and 127.0.0.1).

**Use your own certificate:**

```env
TLS_CERT=/path/to/your/cert.pem
TLS_KEY=/path/to/your/key.pem
```

**Disable TLS:**

```env
TLS_ENABLED=false
```

If OpenSSL is not available, the server falls back to HTTP automatically.

## Docker

### Standalone (SQLite)

```bash
docker compose up --build
```

### With PostgreSQL

```bash
docker compose --profile postgres up --build
```

When using the `postgres` profile, set the database URL:

```env
DATABASE_URL=postgresql://oci_viz:oci_viz_dev@postgres:5432/oci_visualizer
```

The production container runs Prisma migrations automatically on startup. The app is available at `https://localhost:4000`.

## Supported Resource Types

40+ resource types across all major OCI services:

| Category | Types |
|----------|-------|
| Compute | Instances, Images, VNIC Attachments, Boot Volume Attachments, Instance Configurations |
| Network | VCNs, Subnets, Security Lists, Route Tables, NSGs, Internet/NAT/Service Gateways, DRGs, DRG Attachments, LPGs, DHCP Options, Load Balancers, Network Load Balancers |
| Database | DB Systems, Autonomous Databases, MySQL DB Systems, DB Homes |
| Storage | Block Volumes, Boot Volumes, Volume Backups, Volume Groups, File Systems, Buckets |
| Containers | OKE Clusters, Node Pools, Container Instances, Container Repos, Container Images |
| Serverless | Functions Applications, Functions, API Gateways, API Deployments |
| IAM | Compartments, Users, Groups, Policies, Dynamic Groups, API Keys, Customer Secret Keys |
| Security | Vaults, Secrets, Container Scan Results |
| DNS | Zones |
| Observability | Log Groups, Logs |

## API

### GraphQL (`/graphql`)

Key queries:

- `topology(snapshotId, viewType, compartmentId?)` -- Topology graph nodes and edges
- `resources(filter)` -- Paginated, filterable resource list
- `auditFindings(snapshotId)` -- Security audit report with grouped findings
- `reachabilityAnalysis(snapshotId, sourceIp?, destinationIp?, protocol?, port?)` -- Network path analysis
- `snapshotDiff(snapshotIdA, snapshotIdB)` -- Compare two snapshots
- `searchResources(snapshotId, query, limit?)` -- Full-text resource search
- `tagCompliance(snapshotId, requiredTags)` -- Tag coverage report
- `auditTrend` -- Audit finding counts across all snapshots

### REST

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check (DB status, uptime, version) |
| `POST` | `/api/upload/:snapshotId` | Upload ZIP/JSON files (multipart) |
| `GET` | `/api/import-job/:id` | Poll import job status |
| `GET` | `/api/import-job/:id/stream` | SSE real-time import progress |
| `GET` | `/api/snapshot/:id/export` | Download snapshot bundle |
| `POST` | `/api/snapshot/import` | Restore snapshot bundle |
| `GET` | `/api/export-script` | Download OCI export shell script |

## Project Structure

```
oci-visualizer/
  client/                   React frontend
    src/
      pages/                Route pages (Dashboard, Topology, Inventory, Audit, etc.)
      components/           UI components organized by feature
        topology/nodes/     Custom React Flow node components (17 types)
        audit/              Security findings, tag compliance, export
        import/             Upload wizard, progress tracking
        common/             Shared components (search, error boundary, skeletons, toast)
        layout/             App shell, sidebar, global search
      contexts/             Auth, Snapshot, Theme providers
      graphql/              urql client, queries, mutations
      hooks/                Custom React hooks
      types/                TypeScript type definitions
      utils/                Formatters, categories, helpers
  server/                   Node.js backend
    src/
      parsers/              OCI JSON resource parsers (14 service categories)
      services/             Business logic (audit, import, topology, reachability, diff)
      schema/               GraphQL type definitions and resolvers
      middleware/            JWT authentication
      utils/                Export script, snapshot bundling, streaming JSON
    prisma/                 Schema and migrations
  scripts/                  OCI CLI export script
  certs/                    Auto-generated TLS certificates (gitignored)
```

## Development

```bash
# Run both client and server with hot reload
npm run dev

# Build for production
npm run build

# Database migrations
npm run db:migrate

# Generate Prisma client after schema changes
npm run db:generate
```
