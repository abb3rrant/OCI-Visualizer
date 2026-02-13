/**
 * Serverless resource parsers.
 *
 * Handles OCI CLI JSON output for:
 *   - Functions Applications
 *   - Functions
 *   - API Gateways
 *   - API Deployments
 */

import { ParsedResource } from './index.js';
import { unwrap, str, tags, freeform, deepCamelCase } from './helpers.js';

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

export function parseFunctionsApplications(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'serverless/application',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      subnetIds: item['subnet-ids'] ?? null,
      config: item['config'] ?? null,
      syslogUrl: item['syslog-url'] ?? null,
      networkSecurityGroupIds: item['network-security-group-ids'] ?? null,
      shape: item['shape'] ?? null,
      traceConfig: item['trace-config'] ?? null,
      imagePolicyConfig: item['image-policy-config'] ?? null,
    }),
  }));
}

export function parseFunctions(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'serverless/function',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      applicationId: item['application-id'] ?? null,
      image: item['image'] ?? null,
      imageDigest: item['image-digest'] ?? null,
      memoryInMBs: item['memory-in-mbs'] ?? null,
      timeoutInSeconds: item['timeout-in-seconds'] ?? null,
      config: item['config'] ?? null,
      invokeEndpoint: item['invoke-endpoint'] ?? null,
      traceConfig: item['trace-config'] ?? null,
      provisionedConcurrencyConfig:
        item['provisioned-concurrency-config'] ?? null,
      shape: item['shape'] ?? null,
    }),
  }));
}

export function parseApiGateways(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'serverless/api-gateway',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      subnetId: item['subnet-id'] ?? null,
      endpointType: item['endpoint-type'] ?? null,
      hostname: item['hostname'] ?? null,
      certificateId: item['certificate-id'] ?? null,
      ipAddresses: item['ip-addresses'] ?? null,
      networkSecurityGroupIds: item['network-security-group-ids'] ?? null,
      caBundles: item['ca-bundles'] ?? null,
      responseCacheDetails: item['response-cache-details'] ?? null,
    }),
  }));
}

export function parseApiDeployments(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'serverless/api-deployment',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      gatewayId: item['gateway-id'] ?? null,
      pathPrefix: item['path-prefix'] ?? null,
      endpoint: item['endpoint'] ?? null,
      specification: item['specification'] ?? null,
    }),
  }));
}
