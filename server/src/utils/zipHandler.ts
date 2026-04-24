import JSZip from 'jszip';

export interface ExtractedFile {
  name: string;
  content: string;
}

export async function extractZip(buffer: Buffer): Promise<ExtractedFile[]> {
  const zip = await JSZip.loadAsync(buffer);
  const files: ExtractedFile[] = [];

  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    if (!name.endsWith('.json')) continue;
    const content = await entry.async('string');
    files.push({ name, content });
  }

  return files;
}
