# OCI Visualizer

A web application for visualizing Oracle Cloud Infrastructure environments. Import OCI CLI JSON exports, explore interactive topology diagrams, browse resource inventory, and run security audits.

## Quick Start

```bash
# Install dependencies
npm install

# Initialize the database
cd server
DATABASE_URL="file:./prisma/dev.db" npx prisma migrate dev
cd ..

# Start dev servers (API on :4000, UI on :5173)
DATABASE_URL="file:./prisma/dev.db" JWT_SECRET="change-me" npm run dev
```

Open http://localhost:5173, register an account, and start importing.

## Exporting from OCI

Run the included export script against your tenancy:

```bash
chmod +x scripts/generate-oci-export.sh
./scripts/generate-oci-export.sh -c <compartment-ocid>
cd oci-export-* && zip -r ../oci-export.zip *.json
```

Upload the resulting ZIP on the Import page.

## Features

- **Import** -- Upload individual JSON files or ZIP archives from OCI CLI. Auto-detects 31+ resource types.
- **Topology** -- Interactive React Flow diagrams with three views: Network (VCN/subnet nesting), Compartment hierarchy, and Dependency graph.
- **Inventory** -- Searchable, sortable, filterable resource table with CSV export.
- **Audit** -- Security findings (open ingress rules, public subnets, unencrypted volumes, broad IAM policies, stopped instances) and tag compliance checks.
- **Snapshots** -- Named point-in-time imports for tracking changes over time.

## Supported Resource Types

| Category | Types |
|----------|-------|
| Compute | Instances, Images, VNIC Attachments, Boot Volume Attachments |
| Network | VCNs, Subnets, Security Lists, Route Tables, NSGs, Internet/NAT/Service/Local Peering Gateways, DRGs, DHCP Options, Load Balancers |
| Database | DB Systems, Autonomous Databases, DB Homes |
| Storage | Block Volumes, Boot Volumes, Volume Backups, Volume Groups, Buckets |
| Containers | OKE Clusters, Node Pools, Container Instances |
| Serverless | Functions Applications, Functions, API Gateways, API Deployments |
| IAM | Compartments, Users, Groups, Policies, Dynamic Groups |
| DNS | Zones |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TailwindCSS v4, React Flow, urql |
| Backend | Node.js, TypeScript, GraphQL Yoga, Prisma |
| Database | SQLite (dev) / PostgreSQL (production) |
| Auth | JWT + bcrypt |

## Docker Deployment

```bash
cp .env.example .env
# Edit .env with a real JWT_SECRET
docker compose up -d
```

The app will be available at http://localhost:4000 with PostgreSQL running alongside it. To use PostgreSQL in the container, update `server/prisma/schema.prisma` to set `provider = "postgresql"` and set `DATABASE_URL` accordingly.

## Project Structure

```
server/
  prisma/          Schema and migrations
  src/
    parsers/       OCI JSON parsers (one per service)
    services/      Import, relationship builder, topology, audit
    schema/        GraphQL type defs and resolvers
    middleware/    JWT auth

client/
  src/
    pages/         Login, Dashboard, Topology, Inventory, Audit, Import
    components/    Layout, topology nodes/edges, audit, import, common
    graphql/       urql client, queries, mutations
    hooks/         useTopology, useResources, useAudit

scripts/
  generate-oci-export.sh
```
