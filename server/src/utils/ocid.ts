/**
 * Parse OCI resource type from an OCID.
 * OCID format: ocid1.<resource-type>.<realm>.<region>.<unique-id>
 */
export function parseOcidResourceType(ocid: string): string | null {
  if (!ocid || !ocid.startsWith('ocid1.')) return null;
  const parts = ocid.split('.');
  return parts.length >= 2 ? parts[1] : null;
}

export function isValidOcid(ocid: string): boolean {
  return typeof ocid === 'string' && ocid.startsWith('ocid1.');
}

export function extractRegion(ocid: string): string | null {
  if (!isValidOcid(ocid)) return null;
  const parts = ocid.split('.');
  return parts.length >= 4 ? parts[3] : null;
}
