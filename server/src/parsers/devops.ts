/**
 * DevOps resource parsers.
 *
 * Handles OCI CLI JSON output for:
 *   - DevOps Projects
 *   - Build Pipelines
 *   - Deploy Pipelines
 *   - Repositories
 */

import { ParsedResource } from './index.js';
import { unwrap, str, tags, freeform, deepCamelCase } from './helpers.js';

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

export function parseDevopsProjects(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'devops/project',
    displayName: str(item['name'] ?? item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      description: item['description'] ?? null,
      notificationConfig: item['notification-config'] ?? null,
      namespace: item['namespace'] ?? null,
    }),
  }));
}

export function parseDevopsBuildPipelines(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'devops/build-pipeline',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      projectId: item['project-id'] ?? null,
      description: item['description'] ?? null,
      buildPipelineParameters: item['build-pipeline-parameters'] ?? null,
    }),
  }));
}

export function parseDevopsDeployPipelines(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'devops/deploy-pipeline',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      projectId: item['project-id'] ?? null,
      description: item['description'] ?? null,
      deployPipelineParameters: item['deploy-pipeline-parameters'] ?? null,
    }),
  }));
}

export function parseDevopsRepositories(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'devops/repository',
    displayName: str(item['name'] ?? item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      projectId: item['project-id'] ?? null,
      description: item['description'] ?? null,
      repositoryType: item['repository-type'] ?? null,
      defaultBranch: item['default-branch'] ?? null,
      httpUrl: item['http-url'] ?? null,
      sshUrl: item['ssh-url'] ?? null,
      namespace: item['namespace'] ?? null,
      mirrorRepositoryConfig: item['mirror-repository-config'] ?? null,
    }),
  }));
}
