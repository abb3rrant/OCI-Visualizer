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
    }
  }
`;

export const AUDIT_QUERY = gql`
  query AuditFindings($snapshotId: String!) {
    auditFindings(snapshotId: $snapshotId) {
      findings {
        severity
        category
        title
        description
        resourceId
        resourceOcid
        resourceName
        recommendation
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

export const EXPORT_SCRIPT_QUERY = gql`
  query ExportScript {
    exportScript
  }
`;
