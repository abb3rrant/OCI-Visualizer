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
 *   - Local Peering Gateways
 *   - DHCP Options
 */

import { ParsedResource } from './index.js';
import { deepCamelCase } from '../utils/camelCase.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function unwrap(json: any): any[] {
  if (json && json.data !== undefined && json.data !== null) {
    if (Array.isArray(json.data)) return json.data;
    if (typeof json.data === 'object') return [json.data];
  }
  if (Array.isArray(json)) return json;
  if (json && typeof json === 'object') return [json];
  return [];
}

function str(value: unknown): string | null {
  return value === undefined || value === null ? null : String(value);
}

function tags(value: unknown): Record<string, any> | null {
  return value && typeof value === 'object' ? (value as Record<string, any>) : null;
}

function freeform(value: unknown): Record<string, string> | null {
  return value && typeof value === 'object' ? (value as Record<string, string>) : null;
}

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
