export function formatOcid(ocid: string): string {
  if (!ocid || ocid.length < 20) return ocid;
  return `${ocid.slice(0, 20)}...${ocid.slice(-6)}`;
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

export function formatResourceType(type: string): string {
  return type.split('/').pop()?.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || type;
}

export function resourceTypeCategory(type: string): string {
  return type.split('/')[0] || 'unknown';
}
