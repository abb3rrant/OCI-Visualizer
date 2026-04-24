/**
 * Security resource parsers.
 *
 * Handles OCI CLI JSON output for:
 *   - Vaults
 *   - Secrets
 *   - Container Scan Results
 *   - WAF Policies
 *   - Bastions
 *   - Certificates
 *   - Cloud Guard Targets
 *   - Cloud Guard Detector Recipes
 *   - WAAS Policies
 *   - WAAS Certificates
 */

import { ParsedResource } from './index.js';
import { unwrap, str, tags, freeform, deepCamelCase } from './helpers.js';

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

export function parseVaults(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'security/vault',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      vaultType: item['vault-type'] ?? null,
      cryptoEndpoint: item['crypto-endpoint'] ?? null,
      managementEndpoint: item['management-endpoint'] ?? null,
      externalKeyManagerMetadataSummary: item['external-key-manager-metadata-summary'] ?? null,
    }),
  }));
}

export function parseSecrets(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'security/secret',
    displayName: str(item['display-name'] ?? item['secret-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      secretName: item['secret-name'] ?? null,
      vaultId: item['vault-id'] ?? null,
      keyId: item['key-id'] ?? null,
      description: item['description'] ?? null,
      timeOfCurrentVersionExpiry: item['time-of-current-version-expiry'] ?? null,
      timeOfDeletion: item['time-of-deletion'] ?? null,
      lastRotationTime: item['last-rotation-time'] ?? null,
      nextRotationTime: item['next-rotation-time'] ?? null,
      rotationConfig: item['rotation-config'] ?? null,
      rotationStatus: item['rotation-status'] ?? null,
      isAutoGenerationEnabled: item['is-auto-generation-enabled'] ?? null,
    }),
  }));
}

export function parseContainerScanResults(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'security/container-scan-result',
    displayName: str(item['display-name'] ?? ((item['repository'] ?? '') + ':' + (item['image'] ?? ''))),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-started'] ?? item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      repository: item['repository'] ?? null,
      image: item['image'] ?? null,
      containerScanTargetId: item['container-scan-target-id'] ?? null,
      highestProblemSeverity: item['highest-problem-severity'] ?? null,
      problemCount: item['problem-count'] ?? null,
      timeStarted: item['time-started'] ?? null,
      timeFinished: item['time-finished'] ?? null,
    }),
  }));
}

export function parseWafPolicies(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'security/waf-policy',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      webAppFirewallPolicyId: item['web-app-firewall-policy-id'] ?? null,
      backendType: item['backend-type'] ?? null,
      loadBalancerId: item['load-balancer-id'] ?? null,
    }),
  }));
}

export function parseBastions(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'security/bastion',
    displayName: str(item['display-name'] ?? item['name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      bastionType: item['bastion-type'] ?? null,
      targetSubnetId: item['target-subnet-id'] ?? null,
      targetVcnId: item['target-vcn-id'] ?? null,
      clientCidrBlockAllowList: item['client-cidr-block-allow-list'] ?? null,
      maxSessionTtlInSeconds: item['max-session-ttl-in-seconds'] ?? null,
      name: item['name'] ?? null,
    }),
  }));
}

export function parseCertificates(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'security/certificate',
    displayName: str(item['display-name'] ?? item['name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      issuerCertificateAuthorityId: item['issuer-certificate-authority-id'] ?? null,
      configType: item['config-type'] ?? null,
      certificateRules: item['certificate-rules'] ?? null,
      currentVersion: item['current-version'] ?? null,
      name: item['name'] ?? null,
    }),
  }));
}

export function parseCloudGuardTargets(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'security/cloud-guard-target',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      targetResourceType: item['target-resource-type'] ?? null,
      targetResourceId: item['target-resource-id'] ?? null,
      recipeCount: item['recipe-count'] ?? null,
      inheritedByCompartments: item['inherited-by-compartments'] ?? null,
    }),
  }));
}

export function parseCloudGuardDetectorRecipes(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'security/cloud-guard-detector-recipe',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      detector: item['detector'] ?? null,
      description: item['description'] ?? null,
      owner: item['owner'] ?? null,
      sourceDetectorRecipeId: item['source-detector-recipe-id'] ?? null,
      detectorRulesCount: Array.isArray(item['detector-rules']) ? item['detector-rules'].length : null,
    }),
  }));
}

export function parseWaasPolicies(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'security/waas-policy',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      domain: item['domain'] ?? null,
      cname: item['cname'] ?? null,
      additionalDomains: item['additional-domains'] ?? null,
      origins: item['origins'] ?? null,
      wafConfig: item['waf-config'] ?? null,
    }),
  }));
}

export function parseWaasCertificates(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'security/waas-certificate',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      subjectName: item['subject-name'] ?? null,
      issuerName: item['issuer-name'] ?? null,
      serialNumber: item['serial-number'] ?? null,
      timeNotValidBefore: item['time-not-valid-before'] ?? null,
      timeNotValidAfter: item['time-not-valid-after'] ?? null,
      publicKeyInfo: item['public-key-info'] ?? null,
    }),
  }));
}
