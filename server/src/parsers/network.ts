/**
 * Network resource parsers.
 *
 * Handles OCI CLI JSON output for:
 *   - VCNs
 *   - Subnets
 *   - Security Lists
 *   - Route Tables
 *   - Network Security Groups
 *   - Internet Gateways
 *   - NAT Gateways
 *   - Service Gateways
 *   - DRGs
 *   - DRG Attachments
 *   - Local Peering Gateways
 *   - DHCP Options
 *   - NSG Rules
 *   - DRG Route Tables
 *   - DRG Route Rules
 *   - Public IPs
 */

import { ParsedResource } from './index.js';
import { unwrap, str, tags, freeform, deepCamelCase } from './helpers.js';

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

export function parseVcns(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'network/vcn',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: str(item['region']),
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      cidrBlocks: item['cidr-blocks'] ?? item['cidr-block'] ?? null,
      vcnDomainName: item['vcn-domain-name'] ?? null,
      dnsLabel: item['dns-label'] ?? null,
      defaultRouteTableId: item['default-route-table-id'] ?? null,
      defaultSecurityListId: item['default-security-list-id'] ?? null,
      defaultDhcpOptionsId: item['default-dhcp-options-id'] ?? null,
    }),
  }));
}

export function parseSubnets(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'network/subnet',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: str(item['availability-domain']),
    regionKey: str(item['region']),
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      vcnId: item['vcn-id'] ?? null,
      cidrBlock: item['cidr-block'] ?? null,
      dnsLabel: item['dns-label'] ?? null,
      prohibitInternetIngress: item['prohibit-internet-ingress'] ?? null,
      prohibitPublicIpOnVnic: item['prohibit-public-ip-on-vnic'] ?? null,
      routeTableId: item['route-table-id'] ?? null,
      securityListIds: item['security-list-ids'] ?? null,
      dhcpOptionsId: item['dhcp-options-id'] ?? null,
      subnetDomainName: item['subnet-domain-name'] ?? null,
    }),
  }));
}

export function parseSecurityLists(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'network/security-list',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      vcnId: item['vcn-id'] ?? null,
      ingressSecurityRules: item['ingress-security-rules'] ?? null,
      egressSecurityRules: item['egress-security-rules'] ?? null,
    }),
  }));
}

export function parseRouteTables(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'network/route-table',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      vcnId: item['vcn-id'] ?? null,
      routeRules: item['route-rules'] ?? null,
    }),
  }));
}

export function parseNetworkSecurityGroups(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'network/nsg',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      vcnId: item['vcn-id'] ?? null,
    }),
  }));
}

export function parseInternetGateways(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'network/internet-gateway',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      vcnId: item['vcn-id'] ?? null,
      isEnabled: item['is-enabled'] ?? null,
    }),
  }));
}

export function parseNatGateways(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'network/nat-gateway',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      vcnId: item['vcn-id'] ?? null,
      natIp: item['nat-ip'] ?? null,
      blockTraffic: item['block-traffic'] ?? null,
    }),
  }));
}

export function parseServiceGateways(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'network/service-gateway',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      vcnId: item['vcn-id'] ?? null,
      services: item['services'] ?? null,
      routeTableId: item['route-table-id'] ?? null,
      blockTraffic: item['block-traffic'] ?? null,
    }),
  }));
}

export function parseDrgs(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'network/drg',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      defaultDrgRouteTables: item['default-drg-route-tables'] ?? null,
      defaultExportDrgRouteDistributionId:
        item['default-export-drg-route-distribution-id'] ?? null,
    }),
  }));
}

export function parseDrgAttachments(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'network/drg-attachment',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state'] ?? item['state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      drgId: item['drg-id'] ?? null,
      drgRouteTableId: item['drg-route-table-id'] ?? null,
      exportDrgRouteDistributionId: item['export-drg-route-distribution-id'] ?? null,
      networkDetails: item['network-details'] ?? null,
      vcnId: item['vcn-id'] ?? null,
      isCrossTenancy: item['is-cross-tenancy'] ?? null,
      routeTableId: item['route-table-id'] ?? null,
    }),
  }));
}

export function parseLocalPeeringGateways(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'network/local-peering-gateway',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      vcnId: item['vcn-id'] ?? null,
      isCrossTenancyPeering: item['is-cross-tenancy-peering'] ?? null,
      peeringStatus: item['peering-status'] ?? null,
      peerId: item['peer-id'] ?? null,
      peerAdvertisedCidr: item['peer-advertised-cidr'] ?? null,
      peerAdvertisedCidrDetails: item['peer-advertised-cidr-details'] ?? null,
      routeTableId: item['route-table-id'] ?? null,
    }),
  }));
}

export function parseDhcpOptions(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'network/dhcp-options',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      vcnId: item['vcn-id'] ?? null,
      options: item['options'] ?? null,
    }),
  }));
}

export function parseNsgRules(json: any): ParsedResource[] {
  return unwrap(json).map((item: any, index: number) => ({
    ocid: item['id'] ?? item['ocid'] ?? `nsg-rule:${item['network-security-group-id'] ?? 'unknown'}:${index}`,
    resourceType: 'network/nsg-rule',
    displayName: str(item['display-name'] ?? item['description']),
    compartmentId: null,
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: null,
    freeformTags: null,
    rawData: deepCamelCase({
      direction: item['direction'] ?? null,
      protocol: item['protocol'] ?? null,
      source: item['source'] ?? null,
      sourceType: item['source-type'] ?? null,
      destination: item['destination'] ?? null,
      destinationType: item['destination-type'] ?? null,
      tcpOptions: item['tcp-options'] ?? null,
      udpOptions: item['udp-options'] ?? null,
      icmpOptions: item['icmp-options'] ?? null,
      isStateless: item['is-stateless'] ?? null,
      isValid: item['is-valid'] ?? null,
      networkSecurityGroupId: item['network-security-group-id'] ?? null,
      description: item['description'] ?? null,
    }),
  }));
}

export function parseDrgRouteTables(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'network/drg-route-table',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      drgId: item['drg-id'] ?? null,
      importDrgRouteDistributionId: item['import-drg-route-distribution-id'] ?? null,
      isEcmpEnabled: item['is-ecmp-enabled'] ?? null,
    }),
  }));
}

export function parseDrgRouteRules(json: any): ParsedResource[] {
  return unwrap(json).map((item: any, index: number) => ({
    ocid: item['id'] ?? item['ocid'] ?? `drg-route-rule:${item['drg-route-table-id'] ?? 'unknown'}:${index}`,
    resourceType: 'network/drg-route-rule',
    displayName: null,
    compartmentId: null,
    lifecycleState: null,
    availabilityDomain: null,
    regionKey: null,
    timeCreated: null,
    definedTags: null,
    freeformTags: null,
    rawData: deepCamelCase({
      drgRouteTableId: item['drg-route-table-id'] ?? null,
      destinationType: item['destination-type'] ?? null,
      destination: item['destination'] ?? null,
      nextHopDrgAttachmentId: item['next-hop-drg-attachment-id'] ?? null,
      routeType: item['route-type'] ?? null,
      isConflict: item['is-conflict'] ?? null,
      isBlackhole: item['is-blackhole'] ?? null,
      routeProvenance: item['route-provenance'] ?? null,
    }),
  }));
}

export function parsePublicIps(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'network/public-ip',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: str(item['availability-domain']),
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      ipAddress: item['ip-address'] ?? null,
      scope: item['scope'] ?? null,
      lifetime: item['lifetime'] ?? null,
      assignedEntityId: item['assigned-entity-id'] ?? null,
      assignedEntityType: item['assigned-entity-type'] ?? null,
    }),
  }));
}

export function parseVlans(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'network/vlan',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: str(item['availability-domain']),
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      vcnId: item['vcn-id'] ?? null,
      cidrBlock: item['cidr-block'] ?? null,
      vlanTag: item['vlan-tag'] ?? null,
      routeTableId: item['route-table-id'] ?? null,
      nsgIds: item['nsg-ids'] ?? null,
    }),
  }));
}

export function parseCpes(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'network/cpe',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: null,
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      ipAddress: item['ip-address'] ?? null,
      cpeDeviceShapeId: item['cpe-device-shape-id'] ?? null,
      isPrivate: item['is-private'] ?? null,
    }),
  }));
}

export function parseIpsecConnections(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'network/ipsec-connection',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      drgId: item['drg-id'] ?? null,
      cpeId: item['cpe-id'] ?? null,
      cpeLocalIdentifier: item['cpe-local-identifier'] ?? null,
      cpeLocalIdentifierType: item['cpe-local-identifier-type'] ?? null,
      staticRoutes: item['static-routes'] ?? null,
      tunnelConfiguration: item['tunnel-configuration'] ?? null,
    }),
  }));
}

export function parseCrossConnectGroups(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'network/cross-connect-group',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      customerReferenceName: item['customer-reference-name'] ?? null,
    }),
  }));
}

export function parseCrossConnects(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'network/cross-connect',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      crossConnectGroupId: item['cross-connect-group-id'] ?? null,
      locationName: item['location-name'] ?? null,
      portName: item['port-name'] ?? null,
      portSpeedShapeName: item['port-speed-shape-name'] ?? null,
      customerReferenceName: item['customer-reference-name'] ?? null,
    }),
  }));
}

export function parseVirtualCircuits(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'network/virtual-circuit',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      bandwidthShapeName: item['bandwidth-shape-name'] ?? null,
      bgpSessionState: item['bgp-session-state'] ?? null,
      crossConnectMappings: item['cross-connect-mappings'] ?? null,
      gatewayId: item['gateway-id'] ?? null,
      providerName: item['provider-name'] ?? null,
      providerServiceName: item['provider-service-name'] ?? null,
      providerState: item['provider-state'] ?? null,
      type: item['type'] ?? null,
    }),
  }));
}

export function parseRemotePeeringConnections(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'network/remote-peering-connection',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      drgId: item['drg-id'] ?? null,
      peeringStatus: item['peering-status'] ?? null,
      peerId: item['peer-id'] ?? null,
      peerRegionName: item['peer-region-name'] ?? null,
      peerTenancyId: item['peer-tenancy-id'] ?? null,
      isCrossTenancyPeering: item['is-cross-tenancy-peering'] ?? null,
    }),
  }));
}

export function parsePrivateIps(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'network/private-ip',
    displayName: str(item['display-name'] ?? item['hostname-label']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: null,
    availabilityDomain: str(item['availability-domain']),
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      ipAddress: item['ip-address'] ?? null,
      subnetId: item['subnet-id'] ?? null,
      vnicId: item['vnic-id'] ?? null,
      hostnameLabel: item['hostname-label'] ?? null,
      isPrimary: item['is-primary'] ?? null,
      vlanId: item['vlan-id'] ?? null,
    }),
  }));
}

export function parseVtaps(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'network/vtap',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      vcnId: item['vcn-id'] ?? null,
      sourceId: item['source-id'] ?? null,
      sourceType: item['source-type'] ?? null,
      targetId: item['target-id'] ?? null,
      targetType: item['target-type'] ?? null,
      captureFilterId: item['capture-filter-id'] ?? null,
      isVtapEnabled: item['is-vtap-enabled'] ?? null,
      trafficMode: item['traffic-mode'] ?? null,
    }),
  }));
}

export function parseCaptureFilters(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'network/capture-filter',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      filterType: item['filter-type'] ?? null,
      vtapCaptureFilterRules: item['vtap-capture-filter-rules'] ?? null,
      flowLogCaptureFilterRules: item['flow-log-capture-filter-rules'] ?? null,
    }),
  }));
}

export function parseByoipRanges(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'network/byoip-range',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      cidrBlock: item['cidr-block'] ?? null,
      ipv6CidrBlock: item['ipv6-cidr-block'] ?? null,
    }),
  }));
}

export function parsePublicIpPools(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'network/public-ip-pool',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      cidrBlocks: item['cidr-blocks'] ?? null,
    }),
  }));
}

export function parseNetworkFirewalls(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'network/network-firewall',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: str(item['availability-domain']),
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      subnetId: item['subnet-id'] ?? null,
      networkFirewallPolicyId: item['network-firewall-policy-id'] ?? null,
      ipv4Address: item['ipv4-address'] ?? null,
      ipv6Address: item['ipv6-address'] ?? null,
      networkSecurityGroupIds: item['network-security-group-ids'] ?? null,
    }),
  }));
}

export function parseNetworkFirewallPolicies(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'network/network-firewall-policy',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      attachedNetworkFirewallCount: item['attached-network-firewall-count'] ?? null,
    }),
  }));
}

export function parseDrgRouteDistributions(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'network/drg-route-distribution',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: null,
    freeformTags: null,
    rawData: deepCamelCase({
      drgId: item['drg-id'] ?? null,
      distributionType: item['distribution-type'] ?? null,
    }),
  }));
}
