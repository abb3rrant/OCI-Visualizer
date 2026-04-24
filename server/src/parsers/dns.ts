/**
 * DNS resource parsers.
 *
 * Handles OCI CLI JSON output for:
 *   - DNS Zones
 *   - DNS Records
 *   - DNS Views
 *   - DNS Resolvers
 *   - DNS Resolver Endpoints
 *   - DNS Steering Policies
 *   - DNS Steering Policy Attachments
 *   - DNS TSIG Keys
 */

import { ParsedResource } from './index.js';
import { unwrap, str, tags, freeform, deepCamelCase } from './helpers.js';

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

export function parseDnsZones(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'dns/zone',
    displayName: str(item['name'] ?? item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      zoneType: item['zone-type'] ?? null,
      name: item['name'] ?? null,
      serial: item['serial'] ?? null,
      version: item['version'] ?? null,
      scope: item['scope'] ?? null,
      selfUri: item['self'] ?? null,
      isProtected: item['is-protected'] ?? null,
      nameservers: item['nameservers'] ?? null,
      externalMasters: item['external-masters'] ?? null,
      viewId: item['view-id'] ?? null,
    }),
  }));
}

export function parseDnsRecords(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => {
    const domain = str(item['domain']) ?? '';
    const rtype = str(item['rtype']) ?? '';
    const recordHash = str(item['record-hash']) ?? '';
    const rdata = str(item['rdata']) ?? '';
    const zoneId = str(item['zone-name-or-id'] ?? item['zone-id']) ?? '';
    // Records lack OCIDs — synthesize one
    const ocid = recordHash
      ? `dns-record:${zoneId}:${recordHash}`
      : `dns-record:${zoneId}:${domain}:${rtype}:${rdata}`;
    return {
      ocid,
      resourceType: 'dns/record',
      displayName: `${domain} ${rtype}`,
      compartmentId: str(item['compartment-id']),
      lifecycleState: null,
      availabilityDomain: null,
      regionKey: null,
      timeCreated: null,
      definedTags: null,
      freeformTags: null,
      rawData: deepCamelCase({
        domain,
        rtype,
        ttl: item['ttl'] ?? null,
        rdata,
        isProtected: item['is-protected'] ?? null,
        recordHash,
        rrsetVersion: item['rrset-version'] ?? null,
        zoneNameOrId: zoneId,
      }),
    };
  });
}

export function parseDnsViews(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'dns/view',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      isProtected: item['is-protected'] ?? null,
      scope: item['scope'] ?? null,
      selfUri: item['self'] ?? null,
    }),
  }));
}

export function parseDnsResolvers(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'dns/resolver',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      attachedVcnId: item['attached-vcn-id'] ?? null,
      defaultViewId: item['default-view-id'] ?? null,
      isProtected: item['is-protected'] ?? null,
      scope: item['scope'] ?? null,
      selfUri: item['self'] ?? null,
      endpoints: item['endpoints'] ?? null,
      attachedViews: item['attached-views'] ?? null,
    }),
  }));
}

export function parseDnsResolverEndpoints(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? item['name'] ?? '',
    resourceType: 'dns/resolver-endpoint',
    displayName: str(item['name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: null,
    freeformTags: null,
    rawData: deepCamelCase({
      name: item['name'] ?? null,
      endpointType: item['endpoint-type'] ?? null,
      isForwarding: item['is-forwarding'] ?? null,
      isListening: item['is-listening'] ?? null,
      listeningAddress: item['listening-address'] ?? null,
      forwardingAddress: item['forwarding-address'] ?? null,
      subnetId: item['subnet-id'] ?? null,
      nsgIds: item['nsg-ids'] ?? null,
      selfUri: item['self'] ?? null,
    }),
  }));
}

export function parseDnsSteeringPolicies(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'dns/steering-policy',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      template: item['template'] ?? null,
      ttl: item['ttl'] ?? null,
      healthCheckMonitorId: item['health-check-monitor-id'] ?? null,
      rules: item['rules'] ?? null,
      answers: item['answers'] ?? null,
      selfUri: item['self'] ?? null,
    }),
  }));
}

export function parseDnsSteeringPolicyAttachments(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'dns/steering-policy-attachment',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: null,
    freeformTags: null,
    rawData: deepCamelCase({
      steeringPolicyId: item['steering-policy-id'] ?? null,
      zoneId: item['zone-id'] ?? null,
      domainName: item['domain-name'] ?? null,
      selfUri: item['self'] ?? null,
    }),
  }));
}

export function parseDnsTsigKeys(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'dns/tsig-key',
    displayName: str(item['name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      name: item['name'] ?? null,
      algorithm: item['algorithm'] ?? null,
      selfUri: item['self'] ?? null,
    }),
  }));
}
