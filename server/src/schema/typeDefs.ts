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

  enum UserRole {
    ADMIN
    VIEWER
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
    isRegex: Boolean
    first: Int
    after: String
    skip: Int
  }

  # ------------------------------------------------------------------
  # Auth types
  # ------------------------------------------------------------------

  type User {
    id: ID!
    email: String!
    name: String
    role: String!
    approved: Boolean!
    mfaEnabled: Boolean!
    mfaRequired: Boolean!
    team: Team
    createdAt: String!
  }

  type Team {
    id: ID!
    name: String!
    members: [User!]!
    createdAt: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type LoginPayload {
    token: String
    user: User
    mfaRequired: Boolean!
    mfaSetupRequired: Boolean!
    mfaToken: String
  }

  type MfaSetupPayload {
    secret: String!
    qrCodeDataUri: String!
    backupCodes: [String!]!
  }

  type RegisterResult {
    token: String
    user: User!
    message: String!
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
    isShared: Boolean!
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
    imageResource: Resource
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

  type BlobEntry {
    id: ID!
    blobKey: String!
    content: String!
    resource: Resource!
  }

  type BlobEdge {
    cursor: String!
    node: BlobEntry!
  }

  type BlobConnection {
    edges: [BlobEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
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

  type CompartmentCount {
    compartmentId: String!
    compartmentName: String
    count: Int!
  }

  type NamedCount {
    name: String!
    count: Int!
  }

  type AuditRule {
    id: ID!
    name: String!
    description: String
    resourceType: String!
    fieldPath: String!
    operator: String!
    value: String
    severity: String!
    message: String!
    recommendation: String
    category: String!
    framework: String
    enabled: Boolean!
    userId: String!
    createdAt: String!
    updatedAt: String!
  }

  input AuditRuleInput {
    name: String!
    description: String
    resourceType: String!
    fieldPath: String!
    operator: String!
    value: String
    severity: String!
    message: String!
    recommendation: String
    category: String
    framework: String
    enabled: Boolean
  }

  type TagSummary {
    tagKey: String!
    values: [String!]!
    resourceCount: Int!
  }

  type BlobSearchResult {
    resourceId: ID!
    resourceName: String
    blobKey: String!
    snippet: String!
  }

  type DeepSearchResult {
    resourceId: ID!
    resourceType: String!
    displayName: String
    ocid: String!
    snippet: String!
    field: String!
  }

  type ComputeExportRow {
    ocid: String!
    displayName: String
    shape: String
    lifecycleState: String
    availabilityDomain: String
    regionKey: String
    compartmentId: String
    faultDomain: String
    imageOcid: String
    imageDisplayName: String
    imageOs: String
    imageOsVersion: String
    sysInitImage: String
    timeCreated: String
  }

  type ImportResult {
    resourceCount: Int!
    resourceTypes: [String!]!
    errors: [String!]!
  }

  # ------------------------------------------------------------------
  # IAM Analysis (Identity / Attack Paths)
  # ------------------------------------------------------------------

  type IamAnalysisResult {
    graph: IamGraph!
    findings: [IamFinding!]!
    summary: IamSummary!
    principals: [IamPrincipal!]!
    statements: [IamParsedStatement!]!
  }

  type IamGraph {
    nodes: [IamGraphNode!]!
    edges: [IamGraphEdge!]!
  }

  type IamGraphNode {
    id: ID!
    type: String!
    label: String!
    ocid: String!
    metadata: JSON
  }

  type IamGraphEdge {
    id: ID!
    source: String!
    target: String!
    label: String!
    edgeType: String!
    verb: String
  }

  type IamFinding {
    id: ID!
    severity: Severity!
    title: String!
    description: String!
    recommendation: String!
    attackPath: [String!]!
    attackPathNodeIds: [String!]!
    resources: [AffectedResource!]!
    framework: String
  }

  type IamSummary {
    totalUsers: Int!
    totalPolicies: Int!
    criticalPaths: Int!
    privEscPaths: Int!
  }

  type IamPrincipal {
    id: ID!
    ocid: String!
    name: String!
    principalType: String!
    riskLevel: Severity!
    groups: [String!]!
    permissions: [EffectivePermission!]!
    matchingRule: String
    matchedInstanceCount: Int
    ruleAnalysis: String
    blastRadiusNodeIds: [String!]
  }

  type EffectivePermission {
    verb: String!
    resourceType: String!
    scope: String!
    policyName: String!
    conditions: String
  }

  type IamParsedStatement {
    raw: String!
    policyName: String!
    policyOcid: String!
    subject: String!
    subjectType: String!
    verb: String!
    resourceType: String!
    scope: String!
    conditions: String
    parsed: Boolean!
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
    expandInstances(snapshotId: String!, parentOcids: [String!]!): [TopologyNode!]!

    auditFindings(snapshotId: String!): AuditReport!
    resourceFindings(snapshotId: String!, resourceId: String!): [GroupedAuditFinding!]!
    tagCompliance(snapshotId: String!, requiredTags: [String!]!): TagReport!

    reachabilityAnalysis(snapshotId: String!, sourceIp: String, destinationIp: String, protocol: String, port: Int): ReachabilityResult!

    compartmentCounts(snapshotId: String!): [CompartmentCount!]!
    lifecycleStateCounts(snapshotId: String!): [NamedCount!]!

    searchResources(snapshotId: String!, query: String!, isRegex: Boolean, limit: Int): [Resource!]!

    snapshotDiff(snapshotIdA: String!, snapshotIdB: String!): SnapshotDiff!
    auditTrend: [AuditTrendPoint!]!

    users: [User!]!
    pendingUsers: [User!]!
    teams: [Team!]!
    auditRules: [AuditRule!]!

    tagSummary(snapshotId: String!): [TagSummary!]!

    searchBlobs(snapshotId: String!, query: String!, isRegex: Boolean, blobKey: String): [BlobSearchResult!]!

    listBlobs(snapshotId: String!, blobKey: String!, query: String, isRegex: Boolean, first: Int, after: String): BlobConnection!

    deepSearch(snapshotId: String!, query: String!, isRegex: Boolean, limit: Int): [DeepSearchResult!]!

    exportResources(filter: ResourceFilter!): [Resource!]!

    exportComputeInstances(filter: ResourceFilter!): [ComputeExportRow!]!

    exportScript: String!

    iamAnalysis(snapshotId: String!): IamAnalysisResult!
  }

  type Mutation {
    register(email: String!, password: String!, name: String): RegisterResult!
    login(email: String!, password: String!): LoginPayload!

    createSnapshot(name: String!, description: String, importedAt: String): Snapshot!
    deleteSnapshot(id: ID!): Boolean!

    importJson(snapshotId: String!, resourceType: String, jsonData: String!): ImportResult!

    approveUser(userId: ID!): User!
    rejectUser(userId: ID!): Boolean!
    updateUserRole(userId: ID!, role: String!): User!
    createTeam(name: String!): Team!
    addUserToTeam(userId: ID!, teamId: ID!): User!
    removeUserFromTeam(userId: ID!): User!
    shareSnapshot(snapshotId: ID!, isShared: Boolean!): Snapshot!

    changePassword(currentPassword: String!, newPassword: String!): Boolean!
    setupMfa: MfaSetupPayload!
    verifyMfaSetup(code: String!): Boolean!
    disableMfa(password: String!): Boolean!
    verifyMfaLogin(mfaToken: String!, code: String!): AuthPayload!
    resetPasswordForUser(userId: ID!, newPassword: String!): User!
    disableMfaForUser(userId: ID!): User!
    setMfaRequired(userId: ID!, required: Boolean!): User!

    createAuditRule(input: AuditRuleInput!): AuditRule!
    updateAuditRule(id: ID!, input: AuditRuleInput!): AuditRule!
    deleteAuditRule(id: ID!): Boolean!
  }
`;
