# OCI Visualizer - Project Summary

## What This Is

A full-stack web app for importing, visualizing, and auditing Oracle Cloud Infrastructure (OCI) resources. Users export OCI resource data via a CLI script, upload the JSON/ZIP to this app, and get interactive topology diagrams, inventory tables, security audits, and tag compliance reports.

## Tech Stack

| Layer | Tech |
|---|---|
| Monorepo | npm workspaces (`server/`, `client/`) |
| Server | Node.js + GraphQL Yoga v5 (not Express for GraphQL - Express is a dependency but Yoga uses native `http.createServer`) |
| Database | Prisma ORM, SQLite (dev), PostgreSQL (prod). JSON fields stored as **strings** in SQLite. |
| Client | React 18 + Vite + TailwindCSS v4 + urql (GraphQL client) |
| Topology | React Flow (`@xyflow/react` v12+) with dagre layout |
| Auth | JWT (bcryptjs + jsonwebtoken) |

## Architecture Overview

```
scripts/generate-oci-export.sh  -->  JSON files  -->  ZIP upload
                                                          |
client/  (React SPA)  <--GraphQL-->  server/  (GraphQL Yoga)
   |                                    |
   |- pages/                            |- parsers/       (OCI JSON -> ParsedResource)
   |- components/topology/              |- services/import.ts  (upsert to DB)
   |- hooks/useTopology.ts              |- services/relationship.ts  (build edges)
   |- graphql/queries.ts                |- services/topology.ts  (graph generation)
                                        |- services/audit.ts  (security checks)
                                        |- schema/  (GraphQL typeDefs + resolvers)
```

## Database Models (Prisma)

- **User**: Auth. Has many Snapshots.
- **Snapshot**: A point-in-time import of OCI resources. Has many Resources (cascade delete).
- **Resource**: Single OCI resource. Key fields: `ocid`, `resourceType`, `displayName`, `compartmentId`, `lifecycleState`, `rawData` (JSON string), `freeformTags` (JSON string).
  - Unique constraint: `@@unique([ocid, snapshotId])`
- **ResourceRelation**: Typed edge between two Resources. Key fields: `fromResourceId`, `toResourceId`, `relationType`.
  - Unique constraint: `@@unique([fromResourceId, toResourceId, relationType])`

## Resource Type Strings

Every resource has a `resourceType` following the pattern `category/type`. These strings must be consistent across parsers, relationship builder, topology service, and audit service.

| Category | Types |
|---|---|
| `compute/` | `instance`, `image`, `vnic-attachment`, `boot-volume-attachment` |
| `network/` | `vcn`, `subnet`, `security-list`, `route-table`, `nsg`, `internet-gateway`, `nat-gateway`, `service-gateway`, `drg`, `local-peering-gateway`, `dhcp-options`, `load-balancer` |
| `database/` | `db-system`, `autonomous-database`, `db-home` |
| `storage/` | `block-volume`, `boot-volume`, `volume-backup`, `volume-group`, `bucket` |
| `container/` | `cluster`, `node-pool`, `container-instance` |
| `serverless/` | `application`, `function`, `api-gateway`, `api-deployment` |
| `iam/` | `compartment`, `user`, `group`, `policy`, `dynamic-group` |
| `dns/` | `zone` |

**CRITICAL**: Never use `identity/` - the correct prefix is `iam/`. Never use `network/network-security-group` - use `network/nsg`. Never use `functions/function` - use `serverless/function`. Never use `container-engine/cluster` - use `container/cluster`. These were past bugs.

## Relationship Types

Built in `server/src/services/relationship.ts`. Direction is `from -> to`:

| relationType | from | to | Description |
|---|---|---|---|
| `contains` | compartment | resource | Compartment contains resource |
| `contains` | VCN | subnet | VCN contains subnet |
| `parent` | parent compartment | child compartment | Compartment hierarchy |
| `subnet-member` | resource | subnet | Resource lives in subnet |
| `routes-via` | subnet | route-table | Subnet uses route table |
| `secured-by` | subnet | security-list | Subnet uses security list |
| `nsg-member` | resource | NSG | Resource is in NSG (checks both `nsgIds` and `networkSecurityGroupIds`) |
| `volume-attached` | instance | volume | Instance has volume attached |
| `lb-backend` | load-balancer | instance | LB routes to instance |
| `gateway-for` | gateway | VCN | Gateway attached to VCN |
| `runs-in` | function | application | Function belongs to application |
| `uses-vcn` | OKE cluster | VCN | Cluster uses VCN |
| `uses-image` | instance | image | Instance uses image |

## Topology Views

Three views in `server/src/services/topology.ts`, selected via `ViewType` enum:

- **NETWORK**: Shows VCN/subnet hierarchy with instances, DBs, LBs, gateways, NSGs, security lists, route tables. Uses `NETWORK_VIEW_TYPES` whitelist. VCN nodes are parent containers for subnets.
- **COMPARTMENT**: Shows compartment hierarchy tree with all resources nested under their compartment.
- **DEPENDENCY**: Shows cross-resource dependency edges (LB->instance, function->app, cluster->VCN, etc.).

All three views support **compartment filtering with BFS traversal** - when a compartment is selected, resources from all descendant compartments are included (not just the exact match). The shared helper is `getDescendantCompartmentOcids()`.

## OCI CLI JSON Handling

OCI CLI outputs JSON with:
1. `{"data": [...]}` envelope - parsers unwrap this
2. **Kebab-case keys** (e.g., `compartment-id`, `lifecycle-state`, `ingress-security-rules`)

Parsers read kebab-case keys (`item['compartment-id']`) and store top-level Resource fields normally. The `rawData` field is wrapped with `deepCamelCase()` (from `server/src/utils/camelCase.ts`) which recursively converts all nested keys to camelCase. This is critical because:
- The audit service accesses nested rawData fields as camelCase (e.g., `rawData.ingressSecurityRules[].tcpOptions.destinationPortRange`)
- The relationship builder accesses rawData fields as camelCase (e.g., `rawData.vcnId`, `rawData.subnetId`)

## Parser Auto-Detection

`server/src/parsers/index.ts` has a `detectType()` function that inspects the first element of an OCI JSON array and uses field heuristics to determine the resource type. This means **filenames don't matter** for import - only the JSON content matters.

## Export Script

Two versions exist (must be kept in sync):
- `scripts/generate-oci-export.sh` - standalone, human-readable
- `server/src/utils/exportScript.ts` - embedded compact version served via GraphQL `exportScript` query and REST `GET /api/export-script`

Both support:
- `-c OCID` for single compartment
- `-f FILE` for multi-compartment (one OCID per line, `#` comments)
- `-r REGION` and `-o OUTPUT_DIR`

Three export helpers:
- `run_export` / `e()` - standard compartment-scoped exports
- `run_export_per_ad` / `ead()` - for resources requiring `--availability-domain` (boot volumes, boot volume attachments)
- `run_export_per_parent` / `epp()` - for resources requiring a parent ID (functions need `--application-id`, node-pools need `--cluster-id`, API deployments need `--gateway-id`)

Multi-compartment results are merged using `jq`.

## Security Audit Checks

`server/src/services/audit.ts` runs these checks:

| Severity | Check |
|---|---|
| CRITICAL | Open ingress on sensitive ports (22, 3389, 1521, 3306, 5432, 27017) from 0.0.0.0/0 |
| CRITICAL | Publicly accessible buckets |
| HIGH | All-protocol allow rules from 0.0.0.0/0 |
| HIGH | Public subnets (prohibitInternetIngress=false) |
| HIGH | Volumes without customer-managed KMS encryption |
| HIGH | "manage all-resources in tenancy" IAM policies |
| MEDIUM | Instances without NSG membership |
| MEDIUM | Broad "manage" policies at tenancy level |
| MEDIUM | Unattached block volumes |
| MEDIUM | Resources in FAILED/TERMINATING state |
| LOW | Stopped instances |

Also provides tag compliance checking via `runTagCompliance()`.

## Client Pages

| Route | Page | Key Feature |
|---|---|---|
| `/` | DashboardPage | Overview with resource counts |
| `/topology` | TopologyPage | React Flow canvas with NETWORK/COMPARTMENT/DEPENDENCY views + compartment dropdown |
| `/inventory` | InventoryPage | Paginated resource table with type/state/compartment/search filters |
| `/audit` | AuditPage | Security findings + tag compliance |
| `/import` | ImportPage | ZIP/JSON upload + export script download |
| `/login` | LoginPage | JWT auth |

Sidebar has a collapsible compartment tree that navigates to filtered inventory views.

## GraphQL API

**Queries**: `me`, `snapshots`, `snapshot(id)`, `resources(filter)`, `resource(id)`, `resourceByOcid(ocid, snapshotId)`, `resourceCounts(snapshotId)`, `compartments(snapshotId)`, `topology(snapshotId, compartmentId?, viewType)`, `auditFindings(snapshotId)`, `tagCompliance(snapshotId, requiredTags)`, `exportScript`

**Mutations**: `register`, `login`, `createSnapshot`, `deleteSnapshot`, `importJson`

File upload (ZIP) is handled via REST `POST /api/import` with multipart/form-data (busboy), not GraphQL.

## Common Pitfalls

1. **Type string mismatches** are the #1 source of bugs. Always check that any new resource type string matches exactly what the parser produces. Grep across `parsers/`, `services/relationship.ts`, `services/topology.ts`, and `services/audit.ts`.
2. **SQLite stores JSON as strings**. Prisma fields like `rawData`, `definedTags`, `freeformTags`, `metadata` are `String` type. Resolvers parse them with `JSON.parse()` before returning to GraphQL.
3. **rawData must use deepCamelCase**. Any new parser must wrap its rawData object with `deepCamelCase()` or nested field access in audit/relationship services will fail silently.
4. **Compartment filtering uses BFS**. When adding new topology views or filters, use `getDescendantCompartmentOcids()` to include child compartments.
5. **Export scripts must stay in sync**. Changes to `scripts/generate-oci-export.sh` should be mirrored in `server/src/utils/exportScript.ts` and vice versa.
6. **NSG field naming varies**. Some OCI resources use `nsgIds`, others use `networkSecurityGroupIds`. The relationship builder checks both.
