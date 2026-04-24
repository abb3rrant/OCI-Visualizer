import type { PrismaClient } from '@prisma/client';
import { exportSnapshot, importSnapshotBundle } from '../utils/snapshotExport.js';
import { createRebuildRelationshipsJob } from '../services/jobQueue.js';
import { sendJson, requireUser, type Req, type Res } from './_common.js';

export async function handleSnapshotExport(prisma: PrismaClient, req: Req, res: Res, snapshotId: string): Promise<void> {
  const user = requireUser(req, res);
  if (!user) return;

  try {
    const bundle = await exportSnapshot(prisma, snapshotId, user.userId);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="snapshot-${snapshotId}.json"`,
    });
    res.end(JSON.stringify(bundle));
  } catch (err: any) {
    const status = err.message === 'Not authorized' ? 403 : err.message === 'Snapshot not found' ? 404 : 500;
    sendJson(res, status, { error: err.message });
  }
}

export async function handleSnapshotImport(prisma: PrismaClient, req: Req, res: Res): Promise<void> {
  const user = requireUser(req, res);
  if (!user) return;
  if (user.role === 'viewer') {
    return sendJson(res, 403, { error: 'Viewers cannot import snapshots.' });
  }

  const bodyChunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => bodyChunks.push(chunk));
  req.on('end', async () => {
    const body = Buffer.concat(bodyChunks).toString('utf-8');
    let bundle: any;
    try {
      bundle = JSON.parse(body);
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON body' });
    }
    try {
      const snapshotId = await importSnapshotBundle(prisma, user.userId, bundle);
      sendJson(res, 200, { snapshotId });
    } catch (err: any) {
      sendJson(res, 500, { error: err.message || 'Import failed' });
    }
  });
  req.on('error', (err: Error) => sendJson(res, 500, { error: err.message }));
}

export async function handleRebuildRelationships(prisma: PrismaClient, req: Req, res: Res, snapshotId: string): Promise<void> {
  const user = requireUser(req, res);
  if (!user) return;
  if (user.role === 'viewer') {
    return sendJson(res, 403, { error: 'Viewers cannot modify data.' });
  }

  try {
    const snapshot = await prisma.snapshot.findUnique({ where: { id: snapshotId } });
    if (!snapshot) return sendJson(res, 404, { error: 'Snapshot not found.' });
    if (snapshot.userId !== user.userId) {
      return sendJson(res, 403, { error: 'Not authorized.' });
    }

    const jobId = await createRebuildRelationshipsJob(prisma, snapshotId);
    sendJson(res, 202, { jobId });
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
}
