export interface User {
  id: string;
  email: string;
  name: string | null;
}

export interface Snapshot {
  id: string;
  name: string;
  description: string | null;
  importedAt: string;
  resourceCount?: number;
}

export interface Resource {
  id: string;
  ocid: string;
  resourceType: string;
  displayName: string | null;
  compartmentId: string | null;
  lifecycleState: string | null;
  availabilityDomain: string | null;
  regionKey: string | null;
  timeCreated: string | null;
  definedTags: Record<string, any> | null;
  freeformTags: Record<string, string> | null;
  rawData: Record<string, any>;
  relationsFrom?: ResourceRelation[];
  relationsTo?: ResourceRelation[];
}

export interface ResourceBlob {
  id: string;
  blobKey: string;
  content: string;
}

export interface ResourceRelation {
  id: string;
  fromResourceId: string;
  toResourceId: string;
  relationType: string;
  metadata: Record<string, any> | null;
}

export interface ResourceConnection {
  edges: { node: Resource; cursor: string }[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  totalCount: number;
}

export interface TopologyNode {
  id: string;
  type: string;
  label: string;
  resourceType: string;
  ocid: string;
  lifecycleState: string | null;
  metadata: Record<string, any> | null;
  parentNode: string | null;
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  label: string | null;
  relationType: string;
  animated: boolean;
}

export interface Topology {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}

export interface AffectedResource {
  id: string;
  ocid: string;
  name: string | null;
}

export interface GroupedAuditFinding {
  severity: Severity;
  category: string;
  title: string;
  description: string;
  recommendation: string;
  count: number;
  resources: AffectedResource[];
  framework: string | null;
}

export interface AuditReport {
  groupedFindings: GroupedAuditFinding[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
}

export interface TagCoverage {
  tagKey: string;
  count: number;
  total: number;
  percentage: number;
}

export interface TagReport {
  totalResources: number;
  compliantResources: number;
  nonCompliantResources: number;
  tagCoverage: TagCoverage[];
  missingTagResources?: Resource[];
}

export interface ResourceCount {
  resourceType: string;
  count: number;
}

export interface ImportResult {
  resourceCount: number;
  resourceTypes: string[];
  errors: string[];
}

export type ViewType = 'NETWORK' | 'COMPARTMENT' | 'DEPENDENCY' | 'EXPOSURE' | 'REACHABILITY';
export type HopStatus = 'ALLOW' | 'DENY' | 'UNKNOWN';
export type Verdict = 'REACHABLE' | 'BLOCKED' | 'PARTIAL' | 'UNKNOWN';

export interface ReachabilityHop {
  id: string;
  type: string;
  label: string;
  resourceType: string;
  ocid: string;
  status: HopStatus;
  details: string;
  metadata: Record<string, any> | null;
}

export interface ReachabilityLink {
  id: string;
  source: string;
  target: string;
  status: HopStatus;
  label: string;
}

export interface ReachabilityResult {
  hops: ReachabilityHop[];
  links: ReachabilityLink[];
  verdict: Verdict;
  verdictDetail: string;
}

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
