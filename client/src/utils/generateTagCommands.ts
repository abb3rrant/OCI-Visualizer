interface ResourceForTag {
  ocid: string;
  displayName: string | null;
  resourceType: string;
  freeformTags: Record<string, string> | null;
}

type TagAction = 'add' | 'remove' | 'update';

const RESOURCE_TYPE_CLI_MAP: Record<string, { command: string; idFlag: string }> = {
  'compute/instance': { command: 'oci compute instance update', idFlag: '--instance-id' },
  'network/vcn': { command: 'oci network vcn update', idFlag: '--vcn-id' },
  'network/subnet': { command: 'oci network subnet update', idFlag: '--subnet-id' },
  'network/security-list': { command: 'oci network security-list update', idFlag: '--security-list-id' },
  'network/nsg': { command: 'oci network nsg update', idFlag: '--nsg-id' },
  'network/route-table': { command: 'oci network route-table update', idFlag: '--rt-id' },
  'network/internet-gateway': { command: 'oci network internet-gateway update', idFlag: '--ig-id' },
  'network/nat-gateway': { command: 'oci network nat-gateway update', idFlag: '--nat-gateway-id' },
  'network/service-gateway': { command: 'oci network service-gateway update', idFlag: '--service-gateway-id' },
  'network/drg': { command: 'oci network drg update', idFlag: '--drg-id' },
  'network/load-balancer': { command: 'oci lb load-balancer update', idFlag: '--load-balancer-id' },
  'storage/bucket': { command: 'oci os bucket update', idFlag: '--bucket-name' },
  'storage/block-volume': { command: 'oci bv volume update', idFlag: '--volume-id' },
  'storage/boot-volume': { command: 'oci bv boot-volume update', idFlag: '--boot-volume-id' },
  'storage/file-system': { command: 'oci fs file-system update', idFlag: '--file-system-id' },
  'database/autonomous': { command: 'oci db autonomous-database update', idFlag: '--autonomous-database-id' },
  'database/db-system': { command: 'oci db system update', idFlag: '--db-system-id' },
};

function computeNewTags(
  existingTags: Record<string, string> | null,
  action: TagAction,
  tagKey: string,
  tagValue: string,
): Record<string, string> {
  const tags = { ...(existingTags || {}) };

  switch (action) {
    case 'add':
    case 'update':
      tags[tagKey] = tagValue;
      break;
    case 'remove':
      delete tags[tagKey];
      break;
  }

  return tags;
}

export function generateTagCommands(
  resources: ResourceForTag[],
  action: TagAction,
  tagKey: string,
  tagValue: string,
): string {
  const lines: string[] = [
    '#!/bin/bash',
    `# OCI Tag ${action} script`,
    `# Action: ${action} tag "${tagKey}"${action !== 'remove' ? ` = "${tagValue}"` : ''}`,
    `# Resources: ${resources.length}`,
    `# Generated: ${new Date().toISOString()}`,
    '',
    'set -e',
    '',
  ];

  for (const resource of resources) {
    const mapping = RESOURCE_TYPE_CLI_MAP[resource.resourceType];
    if (!mapping) {
      lines.push(`# Skipped: ${resource.displayName || resource.ocid} (unsupported type: ${resource.resourceType})`);
      continue;
    }

    const newTags = computeNewTags(resource.freeformTags, action, tagKey, tagValue);
    const tagsJson = JSON.stringify(newTags);

    lines.push(`# ${resource.displayName || 'Unnamed'} (${resource.resourceType})`);

    // For buckets, the id flag takes the bucket name not OCID
    const idValue = resource.resourceType === 'storage/bucket'
      ? (resource.displayName || resource.ocid)
      : resource.ocid;

    lines.push(
      `${mapping.command} ${mapping.idFlag} "${idValue}" --freeform-tags '${tagsJson}' --force`,
    );
    lines.push('');
  }

  return lines.join('\n');
}

export function downloadScript(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/x-shellscript' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
