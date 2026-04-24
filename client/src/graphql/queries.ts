import { gql } from 'urql';

export const ME_QUERY = gql`
  query Me {
    me {
      id
      email
      name
      role
      mfaEnabled
    }
  }
`;

export const USERS_QUERY = gql`
  query Users {
    users {
      id
      email
      name
      role
      approved
      mfaEnabled
      mfaRequired
      team { id name }
      createdAt
    }
  }
`;

export const PENDING_USERS_QUERY = gql`
  query PendingUsers {
    pendingUsers {
      id
      email
      name
      role
      createdAt
    }
  }
`;

export const TEAMS_QUERY = gql`
  query Teams {
    teams {
      id
      name
      members { id email name }
      createdAt
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
      isShared
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
          rawData
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

export const EXPORT_COMPUTE_INSTANCES_QUERY = gql`
  query ExportComputeInstances($filter: ResourceFilter!) {
    exportComputeInstances(filter: $filter) {
      ocid
      displayName
      shape
      lifecycleState
      availabilityDomain
      regionKey
      compartmentId
      faultDomain
      imageOcid
      imageDisplayName
      imageOs
      imageOsVersion
      sysInitImage
      timeCreated
    }
  }
`;

export const COMPUTE_RESOURCES_QUERY = gql`
  query ComputeResources($filter: ResourceFilter!) {
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
          rawData
          imageResource {
            rawData
          }
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

export const RESOURCE_BLOBS_QUERY = gql`
  query ResourceBlobs($id: ID!) {
    resource(id: $id) {
      id
      blobs {
        id
        blobKey
        content
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

export const EXPAND_INSTANCES_QUERY = gql`
  query ExpandInstances($snapshotId: String!, $parentOcids: [String!]!) {
    expandInstances(snapshotId: $snapshotId, parentOcids: $parentOcids) {
      id
      type
      label
      resourceType
      ocid
      lifecycleState
      metadata
      parentNode
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
      definedTags
      blobs {
        id
        blobKey
        content
      }
    }
  }
`;

export const RESOURCE_BY_OCID_QUERY = gql`
  query ResourceByOcid($ocid: String!, $snapshotId: String!) {
    resourceByOcid(ocid: $ocid, snapshotId: $snapshotId) {
      id
      ocid
      resourceType
      displayName
      lifecycleState
      timeCreated
      rawData
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
  query SearchResources($snapshotId: String!, $query: String!, $isRegex: Boolean, $limit: Int) {
    searchResources(snapshotId: $snapshotId, query: $query, isRegex: $isRegex, limit: $limit) {
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

export const COMPARTMENT_COUNTS_QUERY = gql`
  query CompartmentCounts($snapshotId: String!) {
    compartmentCounts(snapshotId: $snapshotId) {
      compartmentId
      compartmentName
      count
    }
  }
`;

export const LIFECYCLE_STATE_COUNTS_QUERY = gql`
  query LifecycleStateCounts($snapshotId: String!) {
    lifecycleStateCounts(snapshotId: $snapshotId) {
      name
      count
    }
  }
`;

export const TAG_SUMMARY_QUERY = gql`
  query TagSummary($snapshotId: String!) {
    tagSummary(snapshotId: $snapshotId) {
      tagKey
      values
      resourceCount
    }
  }
`;

export const AUDIT_RULES_QUERY = gql`
  query AuditRules {
    auditRules {
      id
      name
      description
      resourceType
      fieldPath
      operator
      value
      severity
      message
      recommendation
      category
      framework
      enabled
      createdAt
      updatedAt
    }
  }
`;

export const SEARCH_BLOBS_QUERY = gql`
  query SearchBlobs($snapshotId: String!, $query: String!, $isRegex: Boolean, $blobKey: String) {
    searchBlobs(snapshotId: $snapshotId, query: $query, isRegex: $isRegex, blobKey: $blobKey) {
      resourceId
      resourceName
      blobKey
      snippet
    }
  }
`;

export const LIST_BLOBS_QUERY = gql`
  query ListBlobs($snapshotId: String!, $blobKey: String!, $query: String, $isRegex: Boolean, $first: Int, $after: String) {
    listBlobs(snapshotId: $snapshotId, blobKey: $blobKey, query: $query, isRegex: $isRegex, first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          blobKey
          content
          resource {
            id
            ocid
            displayName
            lifecycleState
            availabilityDomain
            rawData
            imageResource {
              rawData
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`;

export const NETWORK_RESOURCES_QUERY = gql`
  query NetworkResources($filter: ResourceFilter!) {
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
          rawData
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

export const DEEP_SEARCH_QUERY = gql`
  query DeepSearch($snapshotId: String!, $query: String!, $isRegex: Boolean, $limit: Int) {
    deepSearch(snapshotId: $snapshotId, query: $query, isRegex: $isRegex, limit: $limit) {
      resourceId
      resourceType
      displayName
      ocid
      snippet
      field
    }
  }
`;

export const EXPORT_RESOURCES_QUERY = gql`
  query ExportResources($filter: ResourceFilter!) {
    exportResources(filter: $filter) {
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
      definedTags
    }
  }
`;

export const EXPORT_SCRIPT_QUERY = gql`
  query ExportScript {
    exportScript
  }
`;

export const IAM_ANALYSIS_QUERY = gql`
  query IamAnalysis($snapshotId: String!) {
    iamAnalysis(snapshotId: $snapshotId) {
      graph {
        nodes {
          id
          type
          label
          ocid
          metadata
        }
        edges {
          id
          source
          target
          label
          edgeType
          verb
        }
      }
      findings {
        id
        severity
        title
        description
        recommendation
        attackPath
        attackPathNodeIds
        resources {
          id
          ocid
          name
        }
        framework
      }
      summary {
        totalUsers
        totalPolicies
        criticalPaths
        privEscPaths
      }
      principals {
        id
        ocid
        name
        principalType
        riskLevel
        groups
        permissions {
          verb
          resourceType
          scope
          policyName
          conditions
        }
        matchingRule
        matchedInstanceCount
        ruleAnalysis
        blastRadiusNodeIds
      }
      statements {
        raw
        policyName
        policyOcid
        subject
        subjectType
        verb
        resourceType
        scope
        conditions
        parsed
      }
    }
  }
`;
