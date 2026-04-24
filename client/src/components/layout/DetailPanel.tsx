import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from 'urql';
import type { Resource, ResourceBlob, GroupedAuditFinding } from '../../types';
import { formatOcid, formatDate, formatResourceType } from '../../utils/formatters';
import { getSeverityColor } from '../../utils/colors';
import { useSnapshot } from '../../contexts/SnapshotContext';
import { RESOURCE_FINDINGS_QUERY, RESOURCE_BLOBS_QUERY } from '../../graphql/queries';
import StateBadge from '../common/StateBadge';
import ResourceIcon from '../common/ResourceIcon';
import CopyButton from '../common/CopyButton';
import HighlightedSnippet from '../common/HighlightedSnippet';
import RegexToggle from '../common/RegexToggle';
import SecurityRulesTable from '../common/SecurityRulesTable';
import { useComparison } from '../../contexts/ComparisonContext';

interface DetailPanelProps {
  resource: Resource;
  onClose: () => void;
  onNavigate?: (resourceId: string) => void;
}

// ---------------------------------------------------------------------------
// Per-resource-type field definitions
// ---------------------------------------------------------------------------

interface FieldDef {
  label: string;
  key: string;
  format?: 'ocid' | 'bytes-gb' | 'bytes-tb' | 'boolean' | 'list' | 'json' | 'count';
}

const RESOURCE_FIELDS: Record<string, FieldDef[]> = {
  'compute/instance': [
    { label: 'Shape', key: 'shape' },
    { label: 'Fault Domain', key: 'faultDomain' },
    { label: 'Image ID', key: 'imageId', format: 'ocid' },
    { label: 'Launch Mode', key: 'launchMode' },
  ],
  'compute/image': [
    { label: 'OS', key: 'operatingSystem' },
    { label: 'OS Version', key: 'operatingSystemVersion' },
    { label: 'Size (MB)', key: 'sizeInMBs' },
    { label: 'Create Allowed', key: 'createImageAllowed', format: 'boolean' },
  ],
  'compute/vnic-attachment': [
    { label: 'Instance ID', key: 'instanceId', format: 'ocid' },
    { label: 'VNIC ID', key: 'vnicId', format: 'ocid' },
    { label: 'Subnet ID', key: 'subnetId', format: 'ocid' },
  ],
  'compute/boot-volume-attachment': [
    { label: 'Instance ID', key: 'instanceId', format: 'ocid' },
    { label: 'Boot Volume ID', key: 'bootVolumeId', format: 'ocid' },
    { label: 'In-Transit Encryption', key: 'isPvEncryptionInTransitEnabled', format: 'boolean' },
  ],
  'network/vcn': [
    { label: 'CIDR Blocks', key: 'cidrBlocks', format: 'list' },
    { label: 'Domain Name', key: 'vcnDomainName' },
    { label: 'DNS Label', key: 'dnsLabel' },
  ],
  'network/subnet': [
    { label: 'CIDR Block', key: 'cidrBlock' },
    { label: 'VCN ID', key: 'vcnId', format: 'ocid' },
    { label: 'DNS Label', key: 'dnsLabel' },
    { label: 'Domain Name', key: 'subnetDomainName' },
    { label: 'Public Subnet', key: 'prohibitInternetIngress', format: 'boolean' },
    { label: 'Route Table ID', key: 'routeTableId', format: 'ocid' },
    { label: 'Security Lists', key: 'securityListIds', format: 'count' },
  ],
  'network/security-list': [
    { label: 'VCN ID', key: 'vcnId', format: 'ocid' },
    { label: 'Ingress Rules', key: 'ingressSecurityRules', format: 'count' },
    { label: 'Egress Rules', key: 'egressSecurityRules', format: 'count' },
  ],
  'network/route-table': [
    { label: 'VCN ID', key: 'vcnId', format: 'ocid' },
    { label: 'Route Rules', key: 'routeRules', format: 'count' },
  ],
  'network/nsg': [
    { label: 'VCN ID', key: 'vcnId', format: 'ocid' },
  ],
  'network/internet-gateway': [
    { label: 'VCN ID', key: 'vcnId', format: 'ocid' },
    { label: 'Enabled', key: 'isEnabled', format: 'boolean' },
  ],
  'network/nat-gateway': [
    { label: 'VCN ID', key: 'vcnId', format: 'ocid' },
    { label: 'NAT IP', key: 'natIp' },
    { label: 'Block Traffic', key: 'blockTraffic', format: 'boolean' },
  ],
  'network/service-gateway': [
    { label: 'VCN ID', key: 'vcnId', format: 'ocid' },
    { label: 'Block Traffic', key: 'blockTraffic', format: 'boolean' },
  ],
  'network/local-peering-gateway': [
    { label: 'VCN ID', key: 'vcnId', format: 'ocid' },
    { label: 'Peering Status', key: 'peeringStatus' },
    { label: 'Peer ID', key: 'peerId', format: 'ocid' },
    { label: 'Peer Advertised CIDR', key: 'peerAdvertisedCidr' },
    { label: 'Peer CIDR Details', key: 'peerAdvertisedCidrDetails', format: 'json' },
    { label: 'Cross-Tenancy', key: 'isCrossTenancyPeering', format: 'boolean' },
    { label: 'Route Table ID', key: 'routeTableId', format: 'ocid' },
  ],
  'network/drg': [
    { label: 'Default Route Tables', key: 'defaultDrgRouteTables', format: 'json' },
    { label: 'Export Distribution ID', key: 'defaultExportDrgRouteDistributionId', format: 'ocid' },
  ],
  'network/drg-attachment': [
    { label: 'DRG ID', key: 'drgId', format: 'ocid' },
    { label: 'DRG Route Table ID', key: 'drgRouteTableId', format: 'ocid' },
    { label: 'Export Distribution ID', key: 'exportDrgRouteDistributionId', format: 'ocid' },
    { label: 'Network Details', key: 'networkDetails', format: 'json' },
    { label: 'VCN ID', key: 'vcnId', format: 'ocid' },
    { label: 'Cross-Tenancy', key: 'isCrossTenancy', format: 'boolean' },
  ],
  'network/dhcp-options': [
    { label: 'VCN ID', key: 'vcnId', format: 'ocid' },
    { label: 'Options', key: 'options', format: 'json' },
  ],
  'network/load-balancer': [
    { label: 'Shape', key: 'shapeName' },
    { label: 'Private', key: 'isPrivate', format: 'boolean' },
    { label: 'IP Addresses', key: 'ipAddresses', format: 'json' },
    { label: 'Backend Sets', key: 'backendSets', format: 'count' },
    { label: 'Listeners', key: 'listeners', format: 'count' },
    { label: 'Subnet IDs', key: 'subnetIds', format: 'count' },
  ],
  'database/db-system': [
    { label: 'Shape', key: 'shape' },
    { label: 'DB Edition', key: 'databaseEdition' },
    { label: 'DB Version', key: 'dbVersion' },
    { label: 'CPU Cores', key: 'cpuCoreCount' },
    { label: 'Storage (GB)', key: 'dataStorageSizeInGBs' },
    { label: 'Node Count', key: 'nodeCount' },
    { label: 'License', key: 'licenseModel' },
    { label: 'Hostname', key: 'hostname' },
  ],
  'database/autonomous-database': [
    { label: 'DB Name', key: 'dbName' },
    { label: 'Workload', key: 'dbWorkload' },
    { label: 'DB Version', key: 'dbVersion' },
    { label: 'CPU Cores', key: 'cpuCoreCount' },
    { label: 'Storage (TB)', key: 'dataStorageSizeInTBs' },
    { label: 'Auto Scaling', key: 'isAutoScalingEnabled', format: 'boolean' },
    { label: 'Dedicated', key: 'isDedicated', format: 'boolean' },
    { label: 'Free Tier', key: 'isFreeTier', format: 'boolean' },
    { label: 'License', key: 'licenseModel' },
  ],
  'database/mysql-db-system': [
    { label: 'MySQL Version', key: 'mysqlVersion' },
    { label: 'Shape', key: 'shapeName' },
    { label: 'Subnet ID', key: 'subnetId', format: 'ocid' },
    { label: 'HeatWave Attached', key: 'isHeatWaveClusterAttached', format: 'boolean' },
    { label: 'Highly Available', key: 'isHighlyAvailable', format: 'boolean' },
    { label: 'Port', key: 'port' },
    { label: 'Port X', key: 'portX' },
    { label: 'IP Address', key: 'ipAddress' },
    { label: 'Storage (GB)', key: 'dataStorageSizeInGBs' },
    { label: 'Endpoints', key: 'endpoints', format: 'json' },
    { label: 'Crash Recovery', key: 'crashRecovery' },
  ],
  'database/db-home': [
    { label: 'DB System ID', key: 'dbSystemId', format: 'ocid' },
    { label: 'DB Version', key: 'dbVersion' },
  ],
  'storage/block-volume': [
    { label: 'Size (GB)', key: 'sizeInGBs' },
    { label: 'VPUs/GB', key: 'vpusPerGB' },
    { label: 'Auto Tune', key: 'isAutoTuneEnabled', format: 'boolean' },
    { label: 'KMS Key', key: 'kmsKeyId', format: 'ocid' },
    { label: 'Volume Group', key: 'volumeGroupId', format: 'ocid' },
  ],
  'storage/boot-volume': [
    { label: 'Size (GB)', key: 'sizeInGBs' },
    { label: 'VPUs/GB', key: 'vpusPerGB' },
    { label: 'Image ID', key: 'imageId', format: 'ocid' },
    { label: 'Auto Tune', key: 'isAutoTuneEnabled', format: 'boolean' },
    { label: 'KMS Key', key: 'kmsKeyId', format: 'ocid' },
  ],
  'storage/volume-backup': [
    { label: 'Volume ID', key: 'volumeId', format: 'ocid' },
    { label: 'Type', key: 'type' },
    { label: 'Size (GB)', key: 'sizeInGBs' },
    { label: 'Unique Size (GB)', key: 'uniqueSizeInGBs' },
    { label: 'Expiration', key: 'expirationTime' },
  ],
  'storage/volume-group': [
    { label: 'Volumes', key: 'volumeIds', format: 'count' },
    { label: 'Size (GB)', key: 'sizeInGBs' },
  ],
  'storage/file-system': [
    { label: 'Metered Bytes', key: 'meteredBytes' },
    { label: 'Clone Parent', key: 'isCloneParent', format: 'boolean' },
    { label: 'Hydrated', key: 'isHydrated', format: 'boolean' },
    { label: 'Targetable', key: 'isTargetable', format: 'boolean' },
    { label: 'Clone Count', key: 'cloneCount' },
    { label: 'Clone Attach Status', key: 'cloneAttachStatus' },
    { label: 'Snapshot Policy ID', key: 'filesystemSnapshotPolicyId', format: 'ocid' },
    { label: 'KMS Key', key: 'kmsKeyId', format: 'ocid' },
  ],
  'storage/bucket': [
    { label: 'Namespace', key: 'namespace' },
    { label: 'Access Type', key: 'publicAccessType' },
    { label: 'Storage Tier', key: 'storageTier' },
    { label: 'Versioning', key: 'versioning' },
    { label: 'Events Enabled', key: 'objectEventsEnabled', format: 'boolean' },
    { label: 'Replication', key: 'replicationEnabled', format: 'boolean' },
    { label: 'Read Only', key: 'isReadOnly', format: 'boolean' },
    { label: 'Created By', key: 'createdBy', format: 'ocid' },
  ],
  'container/cluster': [
    { label: 'K8s Version', key: 'kubernetesVersion' },
    { label: 'Type', key: 'type' },
    { label: 'VCN ID', key: 'vcnId', format: 'ocid' },
    { label: 'Endpoints', key: 'endpoints', format: 'json' },
  ],
  'container/node-pool': [
    { label: 'Cluster ID', key: 'clusterId', format: 'ocid' },
    { label: 'K8s Version', key: 'kubernetesVersion' },
    { label: 'Node Shape', key: 'nodeShape' },
    { label: 'Quantity/Subnet', key: 'quantityPerSubnet' },
  ],
  'container/container-instance': [
    { label: 'Shape', key: 'shape' },
    { label: 'Container Count', key: 'containerCount' },
    { label: 'Fault Domain', key: 'faultDomain' },
    { label: 'Restart Policy', key: 'containerRestartPolicy' },
  ],
  'container/container-repository': [
    { label: 'Namespace', key: 'namespace' },
    { label: 'Image Count', key: 'imageCount' },
    { label: 'Immutable', key: 'isImmutable', format: 'boolean' },
    { label: 'Public', key: 'isPublic', format: 'boolean' },
    { label: 'Layer Count', key: 'layerCount' },
    { label: 'Layers Size (bytes)', key: 'layersSizeInBytes' },
    { label: 'Billable Size (GB)', key: 'billableSizeInGbs' },
    { label: 'Created By', key: 'createdBy', format: 'ocid' },
  ],
  'container/container-image': [
    { label: 'Repository ID', key: 'repositoryId', format: 'ocid' },
    { label: 'Repository Name', key: 'repositoryName' },
    { label: 'Digest', key: 'digest' },
    { label: 'Manifest Size (bytes)', key: 'manifestSizeInBytes' },
    { label: 'Layers Size (bytes)', key: 'layersSizeInBytes' },
    { label: 'Versions', key: 'versions', format: 'list' },
    { label: 'Created By', key: 'createdBy', format: 'ocid' },
  ],
  'serverless/application': [
    { label: 'Shape', key: 'shape' },
    { label: 'Subnet IDs', key: 'subnetIds', format: 'count' },
    { label: 'NSG IDs', key: 'networkSecurityGroupIds', format: 'count' },
    { label: 'Syslog URL', key: 'syslogUrl' },
  ],
  'serverless/function': [
    { label: 'Application ID', key: 'applicationId', format: 'ocid' },
    { label: 'Image', key: 'image' },
    { label: 'Memory (MB)', key: 'memoryInMBs' },
    { label: 'Timeout (s)', key: 'timeoutInSeconds' },
    { label: 'Shape', key: 'shape' },
    { label: 'Invoke Endpoint', key: 'invokeEndpoint' },
    { label: 'Image Digest', key: 'imageDigest' },
  ],
  'serverless/api-gateway': [
    { label: 'Hostname', key: 'hostname' },
    { label: 'Endpoint Type', key: 'endpointType' },
    { label: 'Subnet ID', key: 'subnetId', format: 'ocid' },
    { label: 'IP Addresses', key: 'ipAddresses', format: 'json' },
    { label: 'Certificate ID', key: 'certificateId', format: 'ocid' },
  ],
  'serverless/api-deployment': [
    { label: 'Gateway ID', key: 'gatewayId', format: 'ocid' },
    { label: 'Path Prefix', key: 'pathPrefix' },
    { label: 'Endpoint', key: 'endpoint' },
  ],
  'iam/compartment': [
    { label: 'Description', key: 'description' },
    { label: 'Accessible', key: 'isAccessible', format: 'boolean' },
  ],
  'iam/user': [
    { label: 'Email', key: 'email' },
    { label: 'Email Verified', key: 'emailVerified', format: 'boolean' },
    { label: 'Description', key: 'description' },
    { label: 'MFA Activated', key: 'isMfaActivated', format: 'boolean' },
    { label: 'Last Login', key: 'lastSuccessfulLoginTime' },
  ],
  'iam/group': [
    { label: 'Description', key: 'description' },
  ],
  'iam/policy': [
    { label: 'Description', key: 'description' },
    { label: 'Statements', key: 'statements', format: 'list' },
  ],
  'iam/dynamic-group': [
    { label: 'Description', key: 'description' },
    { label: 'Matching Rule', key: 'matchingRule' },
  ],
  'dns/zone': [
    { label: 'Zone Type', key: 'zoneType' },
    { label: 'Name', key: 'name' },
    { label: 'Serial', key: 'serial' },
    { label: 'Scope', key: 'scope' },
    { label: 'Protected', key: 'isProtected', format: 'boolean' },
  ],
  'network/network-load-balancer': [
    { label: 'Subnet ID', key: 'subnetId', format: 'ocid' },
    { label: 'Private', key: 'isPrivate', format: 'boolean' },
    { label: 'IP Version', key: 'nlbIpVersion' },
    { label: 'Preserve Source/Dest', key: 'isPreserveSourceDestination', format: 'boolean' },
    { label: 'Symmetric Hash', key: 'isSymmetricHashEnabled', format: 'boolean' },
    { label: 'IP Addresses', key: 'ipAddresses', format: 'json' },
    { label: 'Listeners', key: 'listeners', format: 'count' },
    { label: 'Backend Sets', key: 'backendSets', format: 'count' },
    { label: 'NSG IDs', key: 'networkSecurityGroupIds', format: 'count' },
  ],
  'compute/instance-configuration': [],
  'security/vault': [
    { label: 'Vault Type', key: 'vaultType' },
    { label: 'Crypto Endpoint', key: 'cryptoEndpoint' },
    { label: 'Management Endpoint', key: 'managementEndpoint' },
  ],
  'security/secret': [
    { label: 'Secret Name', key: 'secretName' },
    { label: 'Vault ID', key: 'vaultId', format: 'ocid' },
    { label: 'Key ID', key: 'keyId', format: 'ocid' },
    { label: 'Description', key: 'description' },
    { label: 'Rotation Status', key: 'rotationStatus' },
    { label: 'Last Rotation', key: 'lastRotationTime' },
    { label: 'Next Rotation', key: 'nextRotationTime' },
    { label: 'Auto Generation', key: 'isAutoGenerationEnabled', format: 'boolean' },
  ],
  'security/container-scan-result': [
    { label: 'Repository', key: 'repository' },
    { label: 'Image', key: 'image' },
    { label: 'Highest Severity', key: 'highestProblemSeverity' },
    { label: 'Problem Count', key: 'problemCount' },
    { label: 'Scan Target ID', key: 'containerScanTargetId', format: 'ocid' },
    { label: 'Time Started', key: 'timeStarted' },
    { label: 'Time Finished', key: 'timeFinished' },
  ],
  'observability/log-group': [
    { label: 'Description', key: 'description' },
    { label: 'Last Modified', key: 'timeLastModified' },
  ],
  'observability/log': [
    { label: 'Log Group ID', key: 'logGroupId', format: 'ocid' },
    { label: 'Log Type', key: 'logType' },
    { label: 'Enabled', key: 'isEnabled', format: 'boolean' },
    { label: 'Retention', key: 'retentionDuration' },
    { label: 'Configuration', key: 'configuration', format: 'json' },
    { label: 'Last Modified', key: 'timeLastModified' },
  ],
  'container/image-signature': [
    { label: 'Image ID', key: 'imageId', format: 'ocid' },
    { label: 'Signing Algorithm', key: 'signingAlgorithm' },
    { label: 'KMS Key ID', key: 'kmsKeyId', format: 'ocid' },
    { label: 'KMS Key Version ID', key: 'kmsKeyVersionId', format: 'ocid' },
  ],
  'iam/api-key': [
    { label: 'Fingerprint', key: 'fingerprint' },
    { label: 'User ID', key: 'userId', format: 'ocid' },
    { label: 'Key Value', key: 'keyValue' },
  ],
  'iam/customer-secret-key': [
    { label: 'User ID', key: 'userId', format: 'ocid' },
    { label: 'Expires', key: 'timeExpires' },
  ],

  // Compute sub-resources
  'compute/volume-attachment': [
    { label: 'Instance ID', key: 'instanceId', format: 'ocid' },
    { label: 'Volume ID', key: 'volumeId', format: 'ocid' },
    { label: 'Attachment Type', key: 'attachmentType' },
    { label: 'Read Only', key: 'isReadOnly', format: 'boolean' },
    { label: 'Shareable', key: 'isShareable', format: 'boolean' },
    { label: 'Device', key: 'device' },
  ],
  'compute/dedicated-vm-host': [
    { label: 'Shape', key: 'dedicatedVmHostShape' },
    { label: 'Total OCPUs', key: 'totalOcpus' },
    { label: 'Remaining OCPUs', key: 'remainingOcpus' },
    { label: 'Total Memory (GB)', key: 'totalMemoryInGBs' },
    { label: 'Remaining Memory (GB)', key: 'remainingMemoryInGBs' },
    { label: 'Fault Domain', key: 'faultDomain' },
  ],
  'compute/autoscaling-config': [
    { label: 'Resource', key: 'resource', format: 'json' },
    { label: 'Cool Down (s)', key: 'coolDownInSeconds' },
    { label: 'Enabled', key: 'isEnabled', format: 'boolean' },
    { label: 'Policies', key: 'policies', format: 'count' },
  ],

  // Network sub-resources
  'network/ipsec-connection': [
    { label: 'DRG ID', key: 'drgId', format: 'ocid' },
    { label: 'CPE ID', key: 'cpeId', format: 'ocid' },
    { label: 'CPE Local ID', key: 'cpeLocalIdentifier' },
    { label: 'Static Routes', key: 'staticRoutes', format: 'list' },
  ],
  'network/virtual-circuit': [
    { label: 'Type', key: 'type' },
    { label: 'Bandwidth', key: 'bandwidthShapeName' },
    { label: 'Cross-Connect Group', key: 'crossConnectGroupId', format: 'ocid' },
    { label: 'Provider', key: 'providerName' },
  ],
  'network/network-firewall': [
    { label: 'Subnet ID', key: 'subnetId', format: 'ocid' },
    { label: 'Policy ID', key: 'networkFirewallPolicyId', format: 'ocid' },
    { label: 'IPv4 Address', key: 'ipv4Address' },
    { label: 'IPv6 Address', key: 'ipv6Address' },
  ],

  // Database sub-resources
  'database/redis-cluster': [
    { label: 'Subnet ID', key: 'subnetId', format: 'ocid' },
    { label: 'Node Count', key: 'nodeCount' },
    { label: 'Node Memory (GB)', key: 'nodeMemoryInGBs' },
    { label: 'Software Version', key: 'softwareVersion' },
    { label: 'Primary Endpoint', key: 'primaryEndpoint' },
    { label: 'Primary FQDN', key: 'primaryFqdn' },
  ],
  'database/opensearch-cluster': [
    { label: 'Subnet ID', key: 'subnetId', format: 'ocid' },
    { label: 'Software Version', key: 'softwareVersion' },
    { label: 'Total Storage (GB)', key: 'totalStorageGB' },
    { label: 'Master Nodes', key: 'masterNodeCount' },
    { label: 'Data Nodes', key: 'dataNodeCount' },
    { label: 'FQDN', key: 'opensearchFqdn' },
  ],
  'database/psql-db-system': [
    { label: 'DB Version', key: 'dbVersion' },
    { label: 'Shape', key: 'shape' },
    { label: 'Instance Count', key: 'instanceCount' },
    { label: 'Admin Username', key: 'adminUsername' },
    { label: 'Storage', key: 'storageDetails', format: 'json' },
    { label: 'Network', key: 'networkDetails', format: 'json' },
  ],
  'database/exadata-infrastructure': [
    { label: 'Shape', key: 'shape' },
    { label: 'Compute Count', key: 'computeCount' },
    { label: 'Storage Count', key: 'storageCount' },
    { label: 'CPUs Enabled', key: 'cpusEnabled' },
    { label: 'Memory (GB)', key: 'memorySizeInGBs' },
    { label: 'Data Storage (TB)', key: 'dataStorageSizeInTBs' },
  ],
  'database/data-guard-association': [
    { label: 'Database ID', key: 'databaseId', format: 'ocid' },
    { label: 'Peer Database ID', key: 'peerDatabaseId', format: 'ocid' },
    { label: 'Role', key: 'role' },
    { label: 'Peer Role', key: 'peerRole' },
    { label: 'Protection Mode', key: 'protectionMode' },
    { label: 'Transport Type', key: 'transportType' },
    { label: 'Apply Lag', key: 'applyLag' },
    { label: 'Apply Rate', key: 'applyRate' },
  ],

  // DevOps
  'devops/project': [
    { label: 'Description', key: 'description' },
    { label: 'Namespace', key: 'namespace' },
  ],
  'devops/build-pipeline': [
    { label: 'Project ID', key: 'projectId', format: 'ocid' },
    { label: 'Description', key: 'description' },
  ],
  'devops/deploy-pipeline': [
    { label: 'Project ID', key: 'projectId', format: 'ocid' },
    { label: 'Description', key: 'description' },
  ],
  'devops/repository': [
    { label: 'Project ID', key: 'projectId', format: 'ocid' },
    { label: 'Repository Type', key: 'repositoryType' },
    { label: 'Default Branch', key: 'defaultBranch' },
    { label: 'HTTP URL', key: 'httpUrl' },
    { label: 'SSH URL', key: 'sshUrl' },
  ],

  // Messaging
  'messaging/stream': [
    { label: 'Partitions', key: 'partitions' },
    { label: 'Retention (hours)', key: 'retentionInHours' },
    { label: 'Endpoint', key: 'messagesEndpoint' },
    { label: 'Stream Pool ID', key: 'streamPoolId', format: 'ocid' },
  ],
  'messaging/queue': [
    { label: 'Retention (s)', key: 'retentionInSeconds' },
    { label: 'Visibility Timeout (s)', key: 'visibilityInSeconds' },
    { label: 'Dead Letter Queue Depth', key: 'deadLetterQueueDeliveryCount' },
    { label: 'Endpoint', key: 'messagesEndpoint' },
  ],
  'messaging/service-connector': [
    { label: 'Description', key: 'description' },
    { label: 'Source', key: 'source', format: 'json' },
    { label: 'Target', key: 'target', format: 'json' },
    { label: 'Tasks', key: 'tasks', format: 'count' },
  ],

  // Governance
  'governance/resource-manager-stack': [
    { label: 'Description', key: 'description' },
    { label: 'Terraform Version', key: 'terraformVersion' },
    { label: 'Config Source', key: 'configSource', format: 'json' },
  ],
  'governance/budget': [
    { label: 'Amount', key: 'amount' },
    { label: 'Reset Period', key: 'resetPeriod' },
    { label: 'Target Type', key: 'targetType' },
    { label: 'Actual Spend', key: 'actualSpend' },
    { label: 'Forecasted Spend', key: 'forecastedSpend' },
    { label: 'Alert Rule Count', key: 'alertRuleCount' },
  ],

  // Monitoring / Health
  'monitoring/health-check-http': [
    { label: 'Protocol', key: 'protocol' },
    { label: 'Targets', key: 'targets', format: 'list' },
    { label: 'Port', key: 'port' },
    { label: 'Path', key: 'path' },
    { label: 'Method', key: 'method' },
    { label: 'Interval (s)', key: 'intervalInSeconds' },
    { label: 'Enabled', key: 'isEnabled', format: 'boolean' },
  ],
  'monitoring/health-check-ping': [
    { label: 'Protocol', key: 'protocol' },
    { label: 'Targets', key: 'targets', format: 'list' },
    { label: 'Port', key: 'port' },
    { label: 'Interval (s)', key: 'intervalInSeconds' },
    { label: 'Enabled', key: 'isEnabled', format: 'boolean' },
  ],
  'monitoring/apm-domain': [
    { label: 'Description', key: 'description' },
    { label: 'Data Upload Endpoint', key: 'dataUploadEndpoint' },
    { label: 'Free Tier', key: 'isFreeTier', format: 'boolean' },
  ],

  // Security additions
  'security/dr-protection-group': [
    { label: 'Role', key: 'role' },
    { label: 'Peer ID', key: 'peerId', format: 'ocid' },
    { label: 'Peer Region', key: 'peerRegion' },
    { label: 'Members', key: 'members', format: 'count' },
  ],
  'security/cloud-guard-target': [
    { label: 'Target Resource Type', key: 'targetResourceType' },
    { label: 'Target Resource ID', key: 'targetResourceId', format: 'ocid' },
    { label: 'Recipe Count', key: 'recipeCount' },
  ],
};

/**
 * For resource types not in RESOURCE_FIELDS (e.g. generic/* types),
 * auto-extract interesting-looking fields from rawData.
 */
function autoExtractFields(rawData: Record<string, any>): FieldDef[] {
  const skip = new Set(['id', 'compartmentId', 'lifecycleState', 'displayName', 'timeCreated',
    'definedTags', 'freeformTags', 'availabilityDomain', 'region']);
  const fields: FieldDef[] = [];
  for (const [key, value] of Object.entries(rawData)) {
    if (skip.has(key)) continue;
    if (value === null || value === undefined) continue;
    if (fields.length >= 12) break;
    const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
    let format: FieldDef['format'] = undefined;
    if (typeof value === 'boolean') format = 'boolean';
    else if (Array.isArray(value)) format = 'list';
    else if (typeof value === 'string' && value.startsWith('ocid1.')) format = 'ocid';
    fields.push({ label, key, format });
  }
  return fields;
}

// ---------------------------------------------------------------------------
// Field value formatter
// ---------------------------------------------------------------------------

function formatFieldValue(value: any, format?: string): React.ReactNode {
  if (value === null || value === undefined) return <span className="text-gray-300">-</span>;

  switch (format) {
    case 'ocid':
      return (
        <span className="font-mono text-xs break-all flex items-start gap-1">
          <span className="flex-1">{formatOcid(String(value))}</span>
          <CopyButton text={String(value)} />
        </span>
      );
    case 'boolean':
      return value === true || value === 'true'
        ? <span className="text-green-600 font-medium">Yes</span>
        : <span className="text-gray-500">No</span>;
    case 'list':
      if (Array.isArray(value)) {
        return (
          <ul className="space-y-0.5">
            {value.map((item, i) => (
              <li key={i} className="break-all">{typeof item === 'string' ? item : JSON.stringify(item)}</li>
            ))}
          </ul>
        );
      }
      return String(value);
    case 'count':
      if (Array.isArray(value) || typeof value === 'object') {
        return <ExpandableField value={value} format="count" />;
      }
      return String(value);
    case 'json':
      if (Array.isArray(value)) {
        // For IP addresses and similar simple arrays of objects, extract key values
        return (
          <ul className="space-y-0.5">
            {value.map((item, i) => (
              <li key={i} className="break-all text-xs">
                {typeof item === 'object' ? (item.ipAddress || item.ip || JSON.stringify(item)) : String(item)}
              </li>
            ))}
          </ul>
        );
      }
      return <span className="text-xs break-all">{JSON.stringify(value)}</span>;
    default:
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
  }
}

// ---------------------------------------------------------------------------
// Relationship label helpers
// ---------------------------------------------------------------------------

const RELATION_LABELS: Record<string, [string, string]> = {
  'contains': ['Contains', 'Contained by'],
  'parent': ['Parent of', 'Child of'],
  'subnet-member': ['In subnet', 'Contains'],
  'routes-via': ['Routes via', 'Routes for'],
  'secured-by': ['Secured by', 'Secures'],
  'nsg-member': ['In NSG', 'Members'],
  'volume-attached': ['Volume attached', 'Attached to'],
  'lb-backend': ['Backend', 'Load balanced by'],
  'gateway-for': ['Gateway for', 'Has gateway'],
  'runs-in': ['Runs in', 'Runs'],
  'uses-vcn': ['Uses VCN', 'Used by'],
  'uses-image': ['Uses image', 'Used by'],
  'member-of': ['Member of', 'Has member'],
  'stored-in': ['Stored in', 'Stores'],
  'deployed-to': ['Deployed to', 'Has deployment'],
  'backup-of': ['Backup of', 'Has backup'],
  'groups': ['Groups', 'Grouped by'],
  'attached-to': ['Attached to', 'Has attachment'],
  'signs': ['Signs', 'Signed by'],
  'belongs-to': ['Belongs to', 'Has'],
  'runs-on': ['Runs on', 'Hosts'],
  'manages': ['Manages', 'Managed by'],
  'monitors': ['Monitors', 'Monitored by'],
  'connects': ['Connects', 'Connected by'],
  'protects': ['Protects', 'Protected by'],
  'uses-config': ['Uses config', 'Config for'],
  'rule-of': ['Rule of', 'Has rule'],
  'assigned-to': ['Assigned to', 'Has assignment'],
  'subscribes-to': ['Subscribes to', 'Has subscriber'],
  'notifies': ['Notifies', 'Notified by'],
  'peered-with': ['Peered with', 'Peered with'],
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// Expandable field value component for count/json fields
const ExpandableField = React.memo(function ExpandableField({ value, format }: { value: any; format: string }) {
  const [expanded, setExpanded] = useState(false);
  const count = Array.isArray(value) ? value.length : typeof value === 'object' ? Object.keys(value).length : 0;
  const summary = `${count} item${count !== 1 ? 's' : ''}`;

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-xs font-medium flex items-center gap-1"
      >
        <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        {summary}
      </button>
      {expanded && (
        <div className="mt-1 ml-4 text-xs">
          {format === 'count' && Array.isArray(value) && (
            <ul className="space-y-1">
              {value.map((item: any, i: number) => (
                <li key={i} className="break-all text-gray-600 dark:text-gray-300 border-l-2 border-gray-200 dark:border-gray-600 pl-2">
                  {typeof item === 'object' ? (
                    <pre className="whitespace-pre-wrap">{JSON.stringify(item, null, 2)}</pre>
                  ) : String(item)}
                </li>
              ))}
            </ul>
          )}
          {format === 'count' && !Array.isArray(value) && typeof value === 'object' && (
            <div className="space-y-1">
              {Object.entries(value).map(([k, v]: [string, any]) => (
                <div key={k} className="border-l-2 border-gray-200 dark:border-gray-600 pl-2">
                  <span className="font-medium text-gray-700 dark:text-gray-200">{k}: </span>
                  <span className="text-gray-600 dark:text-gray-300 break-all">
                    {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// Blob display name formatting
function formatBlobKey(key: string): string {
  return key
    .replace(/-/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, s => s.toUpperCase());
}

const TOPOLOGY_TYPES = new Set([
  'compute/instance', 'network/vcn', 'network/subnet', 'network/security-list',
  'network/nsg', 'network/internet-gateway', 'network/nat-gateway', 'network/service-gateway',
  'network/drg', 'network/local-peering-gateway', 'network/route-table',
  'database/db-system', 'database/autonomous-database', 'load-balancer/load-balancer',
  'storage/bucket', 'container/cluster', 'iam/compartment',
]);

export default function DetailPanel({ resource, onClose, onNavigate }: DetailPanelProps) {
  const navigate = useNavigate();
  const { pinResource, isPinned } = useComparison();
  const [showRawJson, setShowRawJson] = useState(false);
  const [showFindings, setShowFindings] = useState(false);
  const [showBlobs, setShowBlobs] = useState(false);
  const [expandedBlobs, setExpandedBlobs] = useState<Set<string>>(new Set());
  const [jsonSearch, setJsonSearch] = useState('');
  const [jsonRegex, setJsonRegex] = useState(false);

  const toggleBlob = useCallback((blobId: string) => {
    setExpandedBlobs(prev => {
      const next = new Set(prev);
      if (next.has(blobId)) next.delete(blobId);
      else next.add(blobId);
      return next;
    });
  }, []);
  const { currentSnapshot } = useSnapshot();

  // Lazy-load blobs on demand
  const [blobsResult] = useQuery({
    query: RESOURCE_BLOBS_QUERY,
    variables: { id: resource.id },
    pause: !showBlobs,
    requestPolicy: 'cache-first',
  });
  const blobs: ResourceBlob[] = blobsResult.data?.resource?.blobs || [];

  const [findingsResult] = useQuery({
    query: RESOURCE_FINDINGS_QUERY,
    variables: { snapshotId: currentSnapshot?.id || '', resourceId: resource.id },
    pause: !currentSnapshot?.id,
  });

  const findings: GroupedAuditFinding[] = findingsResult.data?.resourceFindings || [];

  const severityBadges = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of findings) {
      counts[f.severity] = (counts[f.severity] || 0) + 1;
    }
    return (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as const)
      .filter(s => counts[s])
      .map(s => ({ severity: s, count: counts[s], color: getSeverityColor(s) }));
  }, [findings]);

  const rawData = resource.rawData || {};
  const fields = useMemo(
    () => RESOURCE_FIELDS[resource.resourceType] || autoExtractFields(rawData),
    [resource.resourceType, rawData],
  );

  // Merge and deduplicate relationships, showing the "other" resource
  const relations = useMemo(() => {
    const result: { id: string; label: string; targetId: string; targetName: string; targetType: string }[] = [];

    for (const rel of resource.relationsFrom || []) {
      const [outLabel] = RELATION_LABELS[rel.relationType] || [rel.relationType];
      const target = (rel as any).toResource;
      result.push({
        id: rel.id,
        label: outLabel,
        targetId: rel.toResourceId,
        targetName: target?.displayName || formatOcid(target?.ocid || rel.toResourceId),
        targetType: target?.resourceType || '',
      });
    }

    for (const rel of resource.relationsTo || []) {
      if (rel.relationType === 'contains') continue;
      const [, inLabel] = RELATION_LABELS[rel.relationType] || [rel.relationType, rel.relationType];
      const source = (rel as any).fromResource;
      result.push({
        id: rel.id,
        label: inLabel,
        targetId: rel.fromResourceId,
        targetName: source?.displayName || formatOcid(source?.ocid || rel.fromResourceId),
        targetType: source?.resourceType || '',
      });
    }

    return result;
  }, [resource.relationsFrom, resource.relationsTo]);

  return (
    <div role="dialog" aria-label={`Details for ${resource.displayName || 'resource'}`} className="w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col shrink-0 overflow-hidden shadow-lg">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <ResourceIcon resourceType={resource.resourceType} />
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{resource.displayName || 'Unnamed'}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">{formatResourceType(resource.resourceType)}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => pinResource(resource)}
            title={isPinned(resource.id) ? 'Pinned for comparison' : 'Pin for comparison'}
            disabled={isPinned(resource.id)}
            className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${isPinned(resource.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <svg className={`w-5 h-5 ${isPinned(resource.id) ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'}`} fill={isPinned(resource.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
          {TOPOLOGY_TYPES.has(resource.resourceType) && (
            <button
              onClick={() => navigate(`/topology?focus=${resource.id}`)}
              title="Show in Topology"
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </button>
          )}
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Status + basic info */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <StateBadge state={resource.lifecycleState} />
            {resource.availabilityDomain && (
              <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">{resource.availabilityDomain}</span>
            )}
            {resource.regionKey && (
              <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">{resource.regionKey}</span>
            )}
          </div>

          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs text-gray-400 dark:text-gray-500 uppercase font-medium">OCID</dt>
              <dd className="font-mono text-xs break-all text-gray-600 dark:text-gray-300 mt-0.5 flex items-start gap-1">
                <span className="flex-1">{resource.ocid}</span>
                <CopyButton text={resource.ocid} />
              </dd>
            </div>
            {resource.compartmentId && (
              <div>
                <dt className="text-xs text-gray-400 dark:text-gray-500 uppercase font-medium">Compartment</dt>
                <dd className="font-mono text-xs break-all text-gray-600 dark:text-gray-300 mt-0.5 flex items-start gap-1">
                  <span className="flex-1">{formatOcid(resource.compartmentId)}</span>
                  <CopyButton text={resource.compartmentId} />
                </dd>
              </div>
            )}
            {resource.timeCreated && (
              <div>
                <dt className="text-xs text-gray-400 dark:text-gray-500 uppercase font-medium">Created</dt>
                <dd className="text-gray-600 dark:text-gray-300 mt-0.5">{formatDate(resource.timeCreated)}</dd>
              </div>
            )}
          </dl>
        </section>

        {/* Resource-type-specific details */}
        {fields.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 border-b border-gray-100 dark:border-gray-700 pb-1">Details</h3>
            <dl className="space-y-2 text-sm">
              {fields.map((field) => {
                const value = rawData[field.key];
                if (value === null || value === undefined) return null;
                return (
                  <div key={field.key}>
                    <dt className="text-xs text-gray-400 dark:text-gray-500 font-medium">{field.label}</dt>
                    <dd className="text-gray-700 dark:text-gray-200 mt-0.5">{formatFieldValue(value, field.format)}</dd>
                  </div>
                );
              })}
            </dl>
          </section>
        )}

        {/* Security Rules (for security-list and nsg) */}
        {(resource.resourceType === 'network/security-list' || resource.resourceType === 'network/nsg') && rawData && (
          <section>
            <SecurityRulesTable rawData={rawData} resourceType={resource.resourceType} />
          </section>
        )}

        {/* Freeform Tags */}
        {resource.freeformTags && Object.keys(resource.freeformTags).length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 border-b border-gray-100 dark:border-gray-700 pb-1">Tags</h3>
            <div className="flex flex-wrap gap-1">
              {Object.entries(resource.freeformTags).map(([k, v]) => (
                <span key={k} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700 border border-blue-100">
                  <span className="font-medium">{k}</span>
                  {v ? <span className="ml-1 text-blue-500">= {v}</span> : null}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Defined Tags */}
        {resource.definedTags && Object.keys(resource.definedTags).length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 border-b border-gray-100 dark:border-gray-700 pb-1">Defined Tags</h3>
            <div className="space-y-2">
              {Object.entries(resource.definedTags).map(([namespace, tags]) => (
                <div key={namespace}>
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{namespace}</div>
                  <div className="flex flex-wrap gap-1">
                    {typeof tags === 'object' && tags !== null && Object.entries(tags).map(([k, v]) => (
                      <span key={k} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-800">
                        <span className="font-medium">{k}</span>
                        {v ? <span className="ml-1 text-purple-500 dark:text-purple-400">= {String(v)}</span> : null}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Blobs (cloud-init, configs, etc.) — loaded on demand */}
        <section>
          <button
            onClick={() => setShowBlobs(prev => !prev)}
            className="w-full flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 border-b border-gray-100 dark:border-gray-700 pb-1 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <svg className={`w-3 h-3 transition-transform ${showBlobs ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            Configuration Data
            {blobs.length > 0 && ` (${blobs.length})`}
          </button>
          {showBlobs && (
            <div className="space-y-2">
              {blobsResult.fetching && <p className="text-xs text-gray-400 dark:text-gray-500">Loading...</p>}
              {blobs.map((blob: ResourceBlob) => (
                <div key={blob.id}>
                  <button
                    onClick={() => toggleBlob(blob.id)}
                    className="w-full flex items-center gap-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                    aria-expanded={expandedBlobs.has(blob.id)}
                  >
                    <svg className={`w-3 h-3 transition-transform ${expandedBlobs.has(blob.id) ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    {formatBlobKey(blob.blobKey)}
                    <span className="text-gray-400 dark:text-gray-500 font-normal ml-auto">
                      {blob.content.length > 1024 ? `${(blob.content.length / 1024).toFixed(1)} KB` : `${blob.content.length} B`}
                    </span>
                  </button>
                  {expandedBlobs.has(blob.id) && (
                    <pre className="mt-1 p-2 bg-gray-50 dark:bg-gray-900 rounded text-xs overflow-auto max-h-60 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all">
                      {blob.content}
                    </pre>
                  )}
                </div>
              ))}
              {!blobsResult.fetching && blobs.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500">No configuration data</p>
              )}
            </div>
          )}
        </section>

        {/* Relationships */}
        {relations.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 border-b border-gray-100 dark:border-gray-700 pb-1">
              Relationships ({relations.length})
            </h3>
            <div className="space-y-1.5">
              {relations.map((rel) => (
                <div
                  key={rel.id}
                  className={`flex items-start gap-2 text-xs p-1.5 rounded ${onNavigate ? 'hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer' : ''}`}
                  onClick={() => onNavigate?.(rel.targetId)}
                >
                  <span className="text-gray-400 dark:text-gray-500 shrink-0 mt-0.5 w-24 text-right">{rel.label}</span>
                  <div className="min-w-0">
                    <div className="text-gray-800 dark:text-gray-200 font-medium truncate">{rel.targetName}</div>
                    {rel.targetType && <div className="text-gray-400 dark:text-gray-500">{formatResourceType(rel.targetType)}</div>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Security Findings */}
        {findings.length > 0 && (
          <section>
            <button
              onClick={() => setShowFindings(!showFindings)}
              className="w-full flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 border-b border-gray-100 dark:border-gray-700 pb-1"
              aria-expanded={showFindings}
            >
              <span>Security Findings ({findings.length})</span>
              <div className="flex gap-1">
                {severityBadges.map(({ severity, count, color }) => (
                  <span key={severity} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: `${color}15`, color }}>
                    {count}
                  </span>
                ))}
              </div>
              <svg
                className={`w-3 h-3 text-gray-400 transition-transform ${showFindings ? 'rotate-90' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            {showFindings && (
              <div className="space-y-2">
                {findings.map((f, i) => {
                  const color = getSeverityColor(f.severity);
                  return (
                    <div key={i} className="p-2 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: `${color}15`, color }}>{f.severity}</span>
                        {f.framework && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: '#7C3AED15', color: '#7C3AED' }}>{f.framework}</span>
                        )}
                      </div>
                      <div className="text-xs font-medium text-gray-900 dark:text-gray-100">{f.title}</div>
                      <div className="text-xs text-blue-700 mt-1">{f.recommendation}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Raw JSON toggle */}
        <section>
          <button
            onClick={() => setShowRawJson(!showRawJson)}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            aria-expanded={showRawJson}
          >
            {showRawJson ? 'Hide' : 'Show'} Raw JSON
          </button>
          {showRawJson && (
            <>
              <div className="flex items-center gap-1.5 mt-2 mb-1">
                <input
                  type="text"
                  placeholder="Search JSON..."
                  value={jsonSearch}
                  onChange={e => setJsonSearch(e.target.value)}
                  className="flex-1 text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 dark:text-gray-200"
                />
                <RegexToggle enabled={jsonRegex} onToggle={() => setJsonRegex(!jsonRegex)} />
              </div>
              <pre className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-xs overflow-auto max-h-96 border border-gray-200 dark:border-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                <HighlightedSnippet
                  text={JSON.stringify(resource.rawData, null, 2)}
                  query={jsonSearch}
                  isRegex={jsonRegex}
                />
              </pre>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
