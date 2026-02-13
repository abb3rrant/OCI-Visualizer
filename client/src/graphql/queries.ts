import { gql } from 'urql';

export const ME_QUERY = gql`
  query Me {
    me {
      id
      email
      name
    }
  }
`;

export const SNAPSHOTS_QUERY = gql`
  query Snapshots {
    snapshots {
      id
      name
      description
      importedAt
      resourceCount
    }
  }
`;

export const SNAPSHOT_QUERY = gql`
  query Snapshot($id: ID!) {
    snapshot(id: $id) {
      id
      name
      description
      importedAt
      resourceCount
    }
  }
`;

export const RESOURCES_QUERY = gql`
  query Resources($filter: ResourceFilter!) {
    resources(filter: $filter) {
      edges {
        node {
          id
          ocid
          resourceType
          displayName
          compartmentId
          lifecycleState
          availabilityDomain
          regionKey
          timeCreated
          freeformTags
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`;

export const RESOURCE_QUERY = gql`
  query Resource($id: ID!) {
    resource(id: $id) {
      id
      ocid
      resourceType
      displayName
      compartmentId
      lifecycleState
      availabilityDomain
      regionKey
      timeCreated
      definedTags
      freeformTags
      rawData
      relationsFrom {
        id
        toResourceId
        relationType
        toResource { id displayName resourceType ocid }
      }
      relationsTo {
        id
        fromResourceId
        relationType
        fromResource { id displayName resourceType ocid }
      }
    }
  }
`;

export const TOPOLOGY_QUERY = gql`
  query Topology($snapshotId: String!, $compartmentId: String, $viewType: ViewType!) {
    topology(snapshotId: $snapshotId, compartmentId: $compartmentId, viewType: $viewType) {
      nodes {
        id
        type
        label
        resourceType
        ocid
        lifecycleState
        metadata
        parentNode
      }
      edges {
        id
        source
        target
        label
        relationType
        animated
      }
      totalCount
      truncated
    }
  }
`;

export const AUDIT_QUERY = gql`
  query AuditFindings($snapshotId: String!) {
    auditFindings(snapshotId: $snapshotId) {
      groupedFindings {
        severity
        category
        title
        description
        recommendation
        count
        framework
        resources {
          id
          ocid
          name
        }
      }
      summary {
        critical
        high
        medium
        low
        info
      }
    }
  }
`;

export const RESOURCE_FINDINGS_QUERY = gql`
  query ResourceFindings($snapshotId: String!, $resourceId: String!) {
    resourceFindings(snapshotId: $snapshotId, resourceId: $resourceId) {
      severity
      category
      title
      description
      recommendation
      count
      framework
    }
  }
`;

export const TAG_COMPLIANCE_QUERY = gql`
  query TagCompliance($snapshotId: String!, $requiredTags: [String!]!) {
    tagCompliance(snapshotId: $snapshotId, requiredTags: $requiredTags) {
      totalResources
      compliantResources
      nonCompliantResources
      tagCoverage {
        tagKey
        count
        total
        percentage
      }
      missingTagResources {
        id
        ocid
        displayName
        resourceType
        compartmentId
        freeformTags
      }
    }
  }
`;

export const RESOURCE_COUNTS_QUERY = gql`
  query ResourceCounts($snapshotId: String!) {
    resourceCounts(snapshotId: $snapshotId) {
      resourceType
      count
    }
  }
`;

export const COMPARTMENTS_QUERY = gql`
  query Compartments($snapshotId: String!) {
    compartments(snapshotId: $snapshotId) {
      id
      ocid
      displayName
      compartmentId
    }
  }
`;

export const RESOURCE_WITH_BLOBS_QUERY = gql`
  query ResourceWithBlobs($id: ID!) {
    resource(id: $id) {
      id
      ocid
      resourceType
      displayName
      compartmentId
      lifecycleState
      availabilityDomain
      regionKey
      timeCreated
      rawData
      freeformTags
      blobs {
        id
        blobKey
        content
      }
    }
  }
`;

export const REACHABILITY_QUERY = gql`
  query ReachabilityAnalysis($snapshotId: String!, $sourceIp: String, $destinationIp: String, $protocol: String, $port: Int) {
    reachabilityAnalysis(snapshotId: $snapshotId, sourceIp: $sourceIp, destinationIp: $destinationIp, protocol: $protocol, port: $port) {
      hops {
        id
        type
        label
        resourceType
        ocid
        status
        details
        metadata
      }
      links {
        id
        source
        target
        status
        label
      }
      verdict
      verdictDetail
    }
  }
`;

export const SEARCH_RESOURCES_QUERY = gql`
  query SearchResources($snapshotId: String!, $query: String!, $limit: Int) {
    searchResources(snapshotId: $snapshotId, query: $query, limit: $limit) {
      id
      ocid
      resourceType
      displayName
    }
  }
`;

export const SNAPSHOT_DIFF_QUERY = gql`
  query SnapshotDiff($snapshotIdA: String!, $snapshotIdB: String!) {
    snapshotDiff(snapshotIdA: $snapshotIdA, snapshotIdB: $snapshotIdB) {
      added { ocid displayName resourceType }
      removed { ocid displayName resourceType }
      changed { ocid displayName resourceType changes { field oldValue newValue } }
    }
  }
`;

export const AUDIT_TREND_QUERY = gql`
  query AuditTrend {
    auditTrend {
      snapshotId
      snapshotName
      date
      critical
      high
      medium
      low
      info
    }
  }
`;

export const EXPORT_SCRIPT_QUERY = gql`
  query ExportScript {
    exportScript
  }
`;
