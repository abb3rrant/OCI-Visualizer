import { PrismaClient } from '@prisma/client';
import path from 'path';
import { importZipBuffer, importJsonString, FILENAME_TO_TYPE, type ProgressCallback } from './import.js';
import { buildRelationships } from './relationship.js';

interface FileEntry {
  filename: string;
  buffer: Buffer;
}

// ---------------------------------------------------------------------------
// SSE connection tracking
// ---------------------------------------------------------------------------

const sseConnections = new Map<string, import('http').ServerResponse[]>();

export function addSseConnection(jobId: string, res: import('http').ServerResponse) {
  const connections = sseConnections.get(jobId) || [];
  connections.push(res);
  sseConnections.set(jobId, connections);
}

export function removeSseConnection(jobId: string, res: import('http').ServerResponse) {
  const connections = sseConnections.get(jobId) || [];
  sseConnections.set(jobId, connections.filter(c => c !== res));
}

function notifySseConnections(jobId: string, data: any) {
  const connections = sseConnections.get(jobId) || [];
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const conn of connections) {
    try { conn.write(msg); } catch {}
  }
}

/**
 * Create an import job and start processing in the background.
 * Returns the job ID immediately so the caller can poll for progress.
 */
export async function createImportJob(
  prisma: PrismaClient,
  snapshotId: string,
  files: FileEntry[],
): Promise<string> {
  const job = await prisma.importJob.create({
    data: { snapshotId, status: 'pending', progress: 0, total: 0 },
  });

  // Fire-and-forget — runs in the background
  processImportJob(prisma, job.id, snapshotId, files).catch((err) => {
    console.error(`Import job ${job.id} crashed:`, err);
    const errorMsg = err instanceof Error ? err.message : String(err);
    prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: 'failed',
        errors: JSON.stringify([errorMsg]),
      },
    }).catch(() => {});
    notifySseConnections(job.id, { status: 'failed', progress: 0, total: 0, errors: [errorMsg] });
  });

  return job.id;
}

async function processImportJob(
  prisma: PrismaClient,
  jobId: string,
  snapshotId: string,
  files: FileEntry[],
) {
  await prisma.importJob.update({
    where: { id: jobId },
    data: { status: 'processing' },
  });

  const allResults: Array<{ resourceCount: number; resourceTypes: string[]; errors: string[] }> = [];
  const hasMultipleJsonFiles = files.filter(f => path.extname(f.filename).toLowerCase() === '.json').length > 1;

  // Throttle progress DB updates to at most once per second
  let lastProgressUpdate = 0;
  const PROGRESS_INTERVAL = 1000;

  const onProgress: ProgressCallback = (processed, total) => {
    const now = Date.now();
    if (now - lastProgressUpdate < PROGRESS_INTERVAL) return;
    lastProgressUpdate = now;
    prisma.importJob.update({
      where: { id: jobId },
      data: { progress: processed, total },
    }).catch(() => {});

    // Notify SSE connections
    notifySseConnections(jobId, { status: 'processing', progress: processed, total });
  };

  for (const { filename, buffer } of files) {
    const ext = path.extname(filename).toLowerCase();
    try {
      if (ext === '.zip') {
        allResults.push(await importZipBuffer(prisma, snapshotId, buffer, onProgress));
      } else if (ext === '.json') {
        const baseName = path.basename(filename, '.json');
        const explicitType = FILENAME_TO_TYPE[baseName];
        allResults.push(
          await importJsonString(prisma, snapshotId, buffer, explicitType, hasMultipleJsonFiles, onProgress),
        );
      } else {
        allResults.push({ resourceCount: 0, resourceTypes: [], errors: [`Unsupported: ${ext}`] });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      allResults.push({ resourceCount: 0, resourceTypes: [], errors: [message] });
    }
  }

  // Build relationships once after all files are imported
  if (hasMultipleJsonFiles) {
    try {
      await buildRelationships(prisma, snapshotId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      allResults.push({ resourceCount: 0, resourceTypes: [], errors: [`Failed to build relationships: ${message}`] });
    }
  }

  const aggregated = {
    resourceCount: allResults.reduce((sum, r) => sum + r.resourceCount, 0),
    resourceTypes: [...new Set(allResults.flatMap((r) => r.resourceTypes))],
    errors: allResults.flatMap((r) => r.errors),
  };

  await prisma.importJob.update({
    where: { id: jobId },
    data: {
      status: 'completed',
      progress: aggregated.resourceCount,
      total: aggregated.resourceCount,
      resourceTypes: JSON.stringify(aggregated.resourceTypes),
      errors: aggregated.errors.length > 0 ? JSON.stringify(aggregated.errors) : null,
    },
  });

  // Notify SSE connections of completion
  notifySseConnections(jobId, {
    status: 'completed',
    progress: aggregated.resourceCount,
    total: aggregated.resourceCount,
    resourceTypes: aggregated.resourceTypes,
    errors: aggregated.errors,
  });
}
