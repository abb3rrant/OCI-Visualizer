export const typeDefs = /* GraphQL */ `
  scalar JSON

  # ------------------------------------------------------------------
  # Enums
  # ------------------------------------------------------------------

  enum ViewType {
    NETWORK
    COMPARTMENT
    DEPENDENCY
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
  # Audit
  # ------------------------------------------------------------------

  type AuditReport {
    findings: [AuditFinding!]!
    summary: AuditSummary!
  }

  type AuditSummary {
    critical: Int!
    high: Int!
    medium: Int!
    low: Int!
    info: Int!
  }

  type AuditFinding {
    severity: Severity!
    category: String!
    title: String!
    description: String!
    resourceId: String
    resourceOcid: String
    resourceName: String
    recommendation: String!
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
    tagCompliance(snapshotId: String!, requiredTags: [String!]!): TagReport!

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
