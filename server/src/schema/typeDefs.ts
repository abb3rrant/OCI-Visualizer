export const typeDefs = /* GraphQL */ `
  scalar JSON

  # ------------------------------------------------------------------
  # Enums
  # ------------------------------------------------------------------

  enum ViewType {
    NETWORK
    COMPARTMENT
    DEPENDENCY
    EXPOSURE
  }

  enum Severity {
    CRITICAL
    HIGH
    MEDIUM
    LOW
    INFO
  }

  # ------------------------------------------------------------------
  # Inputs
  # ------------------------------------------------------------------

  input ResourceFilter {
    snapshotId: String!
    resourceType: String
    compartmentId: String
    lifecycleState: String
    search: String
    first: Int
    after: String
  }

  # ------------------------------------------------------------------
  # Auth types
  # ------------------------------------------------------------------

  type User {
    id: ID!
    email: String!
    name: String
    createdAt: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  # ------------------------------------------------------------------
  # Snapshot
  # ------------------------------------------------------------------

  type Snapshot {
    id: ID!
    name: String!
    description: String
    importedAt: String!
    userId: String!
    resourceCount: Int!
  }

  # ------------------------------------------------------------------
  # Resource & relations
  # ------------------------------------------------------------------

  type Resource {
    id: ID!
    ocid: String!
    resourceType: String!
    displayName: String
    compartmentId: String
    lifecycleState: String
    availabilityDomain: String
    regionKey: String
    timeCreated: String
    definedTags: JSON
    freeformTags: JSON
    rawData: JSON
    snapshotId: String!
    relationsFrom: [ResourceRelation!]!
    relationsTo: [ResourceRelation!]!
    blobs: [ResourceBlob!]!
  }

  type ResourceBlob {
    id: ID!
    blobKey: String!
    content: String!
  }

  type ResourceRelation {
    id: ID!
    fromResourceId: String!
    toResourceId: String!
    relationType: String!
    metadata: JSON
    fromResource: Resource
    toResource: Resource
  }

  # ------------------------------------------------------------------
  # Pagination (cursor-based)
  # ------------------------------------------------------------------

  type ResourceConnection {
    edges: [ResourceEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type ResourceEdge {
    cursor: String!
    node: Resource!
  }

  type PageInfo {
    hasNextPage: Boolean!
    endCursor: String
  }

  # ------------------------------------------------------------------
  # Topology
  # ------------------------------------------------------------------

  type Topology {
    nodes: [TopologyNode!]!
    edges: [TopologyEdge!]!
    totalCount: Int!
    truncated: Boolean!
  }

  type TopologyNode {
    id: ID!
    type: String!
    label: String!
    resourceType: String!
    ocid: String!
    lifecycleState: String
    metadata: JSON
    parentNode: String
  }

  type TopologyEdge {
    id: ID!
    source: String!
    target: String!
    label: String
    relationType: String!
    animated: Boolean!
  }

  # ------------------------------------------------------------------
  # Reachability analysis
  # ------------------------------------------------------------------

  type ReachabilityHop {
    id: ID!
    type: String!
    label: String!
    resourceType: String!
    ocid: String!
    status: String!
    details: String!
    metadata: JSON
  }

  type ReachabilityLink {
    id: ID!
    source: String!
    target: String!
    status: String!
    label: String!
  }

  type ReachabilityResult {
    hops: [ReachabilityHop!]!
    links: [ReachabilityLink!]!
    verdict: String!
    verdictDetail: String!
  }

  # ------------------------------------------------------------------
  # Audit
  # ------------------------------------------------------------------

  type AuditReport {
    groupedFindings: [GroupedAuditFinding!]!
    summary: AuditSummary!
  }

  type AuditSummary {
    critical: Int!
    high: Int!
    medium: Int!
    low: Int!
    info: Int!
  }

  type AffectedResource {
    id: String!
    ocid: String!
    name: String
  }

  type GroupedAuditFinding {
    severity: Severity!
    category: String!
    title: String!
    description: String!
    recommendation: String!
    count: Int!
    resources: [AffectedResource!]!
    framework: String
  }

  # ------------------------------------------------------------------
  # Tag compliance
  # ------------------------------------------------------------------

  type TagReport {
    totalResources: Int!
    compliantResources: Int!
    nonCompliantResources: Int!
    tagCoverage: [TagCoverage!]!
    missingTagResources: [Resource!]!
  }

  type TagCoverage {
    tagKey: String!
    count: Int!
    total: Int!
    percentage: Float!
  }

  # ------------------------------------------------------------------
  # Snapshot Diff
  # ------------------------------------------------------------------

  type DiffResource {
    ocid: String!
    displayName: String
    resourceType: String!
  }

  type ChangedField {
    field: String!
    oldValue: JSON
    newValue: JSON
  }

  type ChangedResource {
    ocid: String!
    displayName: String
    resourceType: String!
    changes: [ChangedField!]!
  }

  type SnapshotDiff {
    added: [DiffResource!]!
    removed: [DiffResource!]!
    changed: [ChangedResource!]!
  }

  # ------------------------------------------------------------------
  # Audit Trend
  # ------------------------------------------------------------------

  type AuditTrendPoint {
    snapshotId: String!
    snapshotName: String!
    date: String!
    critical: Int!
    high: Int!
    medium: Int!
    low: Int!
    info: Int!
  }

  # ------------------------------------------------------------------
  # Misc
  # ------------------------------------------------------------------

  type ResourceCount {
    resourceType: String!
    count: Int!
  }

  type ImportResult {
    resourceCount: Int!
    resourceTypes: [String!]!
    errors: [String!]!
  }

  # ------------------------------------------------------------------
  # Root types
  # ------------------------------------------------------------------

  type Query {
    me: User

    snapshots: [Snapshot!]!
    snapshot(id: ID!): Snapshot

    resources(filter: ResourceFilter!): ResourceConnection!
    resource(id: ID!): Resource
    resourceByOcid(ocid: String!, snapshotId: String!): Resource
    resourceCounts(snapshotId: String!): [ResourceCount!]!
    compartments(snapshotId: String!): [Resource!]!

    topology(snapshotId: String!, compartmentId: String, viewType: ViewType!): Topology!

    auditFindings(snapshotId: String!): AuditReport!
    resourceFindings(snapshotId: String!, resourceId: String!): [GroupedAuditFinding!]!
    tagCompliance(snapshotId: String!, requiredTags: [String!]!): TagReport!

    reachabilityAnalysis(snapshotId: String!, sourceIp: String, destinationIp: String, protocol: String, port: Int): ReachabilityResult!

    searchResources(snapshotId: String!, query: String!, limit: Int): [Resource!]!

    snapshotDiff(snapshotIdA: String!, snapshotIdB: String!): SnapshotDiff!
    auditTrend: [AuditTrendPoint!]!

    exportScript: String!
  }

  type Mutation {
    register(email: String!, password: String!, name: String): AuthPayload!
    login(email: String!, password: String!): AuthPayload!

    createSnapshot(name: String!, description: String): Snapshot!
    deleteSnapshot(id: ID!): Boolean!

    importJson(snapshotId: String!, resourceType: String, jsonData: String!): ImportResult!
  }
`;
