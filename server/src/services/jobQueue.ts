import { PrismaClient } from '@prisma/client';
import path from 'path';
import { importZipBuffer, importJsonString, FILENAME_TO_TYPE, type ProgressCallback } from './import.js';
import { buildRelationships } from './relationship.js';
import { invalidateAuditCache } from './audit.js';
import { invalidateIamCache } from './iamAnalysis.js';
import { logger } from '../utils/logger.js';

interface FileEntry {
  filename: string;
  buffer: Buffer;
}

// ---------------------------------------------------------------------------
// SSE connection tracking
// ---------------------------------------------------------------------------

const MAX_SSE_PER_JOB = 10;
const sseConnections = new Map<string, import('http').ServerResponse[]>();

export function addSseConnection(jobId: string, res: import('http').ServerResponse) {
  const connections = sseConnections.get(jobId) || [];
  // Evict oldest connection if at capacity
  while (connections.length >= MAX_SSE_PER_JOB) {
    const oldest = connections.shift();
    try { oldest?.end(); } catch {}
  }
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

// Prune dead SSE connections every 60 seconds
setInterval(() => {
  for (const [jobId, connections] of sseConnections) {
    const alive = connections.filter(c => !c.writableEnded);
    if (alive.length === 0) {
      sseConnections.delete(jobId);
    } else {
      sseConnections.set(jobId, alive);
    }
  }
}, 60_000);

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
  processImportJob(prisma, job.id, snapshotId, files).catch(async (err) => {
    logger.error(`Import job ${job.id} crashed`, { error: String(err) });
    const errorMsg = err instanceof Error ? err.message : String(err);
    // Retry the status update up to 3 times to avoid stuck "processing" jobs
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await prisma.importJob.update({
          where: { id: job.id },
          data: {
            status: 'failed',
            errors: JSON.stringify([errorMsg]),
          },
        });
        break;
      } catch (updateErr) {
        logger.error(`Failed to mark job ${job.id} as failed (attempt ${attempt + 1})`, { error: String(updateErr) });
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
      }
    }
    notifySseConnections(job.id, { status: 'failed', progress: 0, total: 0, errors: [errorMsg] });
    sseConnections.delete(job.id);
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

  // Track cumulative progress across all files so the progress bar never resets
  let cumulativeCount = 0;
  let cumulativeTotal = 0;

  const onProgress: ProgressCallback = (processed, fileTotal) => {
    const globalProcessed = cumulativeCount + processed;
    const globalTotal = cumulativeTotal + fileTotal;
    const now = Date.now();
    if (now - lastProgressUpdate < PROGRESS_INTERVAL) return;
    lastProgressUpdate = now;
    prisma.importJob.update({
      where: { id: jobId },
      data: { progress: globalProcessed, total: globalTotal },
    }).catch(() => {});

    // Notify SSE connections
    notifySseConnections(jobId, { status: 'processing', progress: globalProcessed, total: globalTotal });
  };

  for (let fi = 0; fi < files.length; fi++) {
    const { filename, buffer } = files[fi];
    const ext = path.extname(filename).toLowerCase();
    logger.info(`Processing import file`, { jobId, filename, bytes: buffer.length, ext });
    try {
      if (ext === '.zip') {
        // Skip relationships in individual imports — we build once at the end
        allResults.push(await importZipBuffer(prisma, snapshotId, buffer, true, onProgress));
      } else if (ext === '.json') {
        const baseName = path.basename(filename, '.json');
        const explicitType = FILENAME_TO_TYPE[baseName];
        // Skip relationships in individual imports — we build once at the end
        allResults.push(
          await importJsonString(prisma, snapshotId, buffer, explicitType, true, onProgress),
        );
      } else {
        allResults.push({ resourceCount: 0, resourceTypes: [], errors: [`Unsupported: ${ext}`] });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      allResults.push({ resourceCount: 0, resourceTypes: [], errors: [message] });
    }

    // Accumulate this file's counts so the next file's progress offsets correctly
    const lastResult = allResults[allResults.length - 1];
    cumulativeCount += lastResult.resourceCount;
    // Only add to cumulativeTotal for files that reported a known total (direct path);
    // streaming files report total=0 so they don't inflate the denominator
    // (their per-file total is already 0, so adding it is a no-op)
    cumulativeTotal += lastResult.resourceCount;

    // Release the buffer so GC can reclaim memory before processing the next file
    (files[fi] as any).buffer = null;
  }

  // Build relationships once after all files are imported
  try {
    await buildRelationships(prisma, snapshotId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    allResults.push({ resourceCount: 0, resourceTypes: [], errors: [`Failed to build relationships: ${message}`] });
  }

  // Invalidate caches since snapshot data has changed
  invalidateAuditCache(snapshotId);
  invalidateIamCache(snapshotId);

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

  // Notify SSE connections of completion and clean up
  notifySseConnections(jobId, {
    status: 'completed',
    progress: aggregated.resourceCount,
    total: aggregated.resourceCount,
    resourceTypes: aggregated.resourceTypes,
    errors: aggregated.errors,
  });
  sseConnections.delete(jobId);
}

// ---------------------------------------------------------------------------
// Rebuild relationships job
// ---------------------------------------------------------------------------

/**
 * Create a job that deletes existing relationships for a snapshot and
 * rebuilds them from scratch.  Returns the job ID immediately; the actual
 * work runs in the background and reports progress via SSE.
 */
export async function createRebuildRelationshipsJob(
  prisma: PrismaClient,
  snapshotId: string,
): Promise<string> {
  const job = await prisma.importJob.create({
    data: { snapshotId, status: 'pending', progress: 0, total: 0 },
  });

  processRebuildJob(prisma, job.id, snapshotId).catch(async (err) => {
    logger.error(`Rebuild job ${job.id} crashed`, { error: String(err) });
    const errorMsg = err instanceof Error ? err.message : String(err);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await prisma.importJob.update({
          where: { id: job.id },
          data: { status: 'failed', errors: JSON.stringify([errorMsg]) },
        });
        break;
      } catch (updateErr) {
        logger.error(`Failed to mark rebuild job ${job.id} as failed (attempt ${attempt + 1})`, { error: String(updateErr) });
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
      }
    }
    notifySseConnections(job.id, { status: 'failed', progress: 0, total: 0, errors: [errorMsg] });
    sseConnections.delete(job.id);
  });

  return job.id;
}

async function processRebuildJob(
  prisma: PrismaClient,
  jobId: string,
  snapshotId: string,
) {
  await prisma.importJob.update({
    where: { id: jobId },
    data: { status: 'processing' },
  });
  notifySseConnections(jobId, { status: 'processing', progress: 0, total: 0 });

  // Delete all existing relationships for this snapshot's resources
  const resourceIds = await prisma.resource.findMany({
    where: { snapshotId },
    select: { id: true },
  });
  const ids = resourceIds.map(r => r.id);

  if (ids.length > 0) {
    await prisma.resourceRelation.deleteMany({
      where: {
        OR: [
          { fromResourceId: { in: ids } },
          { toResourceId: { in: ids } },
        ],
      },
    });
  }

  // Rebuild
  const count = await buildRelationships(prisma, snapshotId);

  // Invalidate caches since relationships changed
  invalidateAuditCache(snapshotId);
  invalidateIamCache(snapshotId);

  await prisma.importJob.update({
    where: { id: jobId },
    data: {
      status: 'completed',
      progress: count,
      total: count,
      resourceTypes: JSON.stringify([]),
      errors: null,
    },
  });

  notifySseConnections(jobId, {
    status: 'completed',
    progress: count,
    total: count,
    resourceTypes: [],
    errors: [],
  });
  sseConnections.delete(jobId);
}
