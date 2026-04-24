import type { PrismaClient } from '@prisma/client';
import { verifyToken } from '../middleware/auth.js';
import { addSseConnection, removeSseConnection } from '../services/jobQueue.js';
import { sendJson, requireUser, type Req, type Res } from './_common.js';

export async function handleImportJobStatus(prisma: PrismaClient, req: Req, res: Res, jobId: string): Promise<void> {
  try {
    const job = await prisma.importJob.findUnique({ where: { id: jobId } });
    if (!job) return sendJson(res, 404, { error: 'Job not found.' });
    sendJson(res, 200, {
      id: job.id,
      snapshotId: job.snapshotId,
      status: job.status,
      progress: job.progress,
      total: job.total,
      resourceTypes: job.resourceTypes ? JSON.parse(job.resourceTypes) : [],
      errors: job.errors ? JSON.parse(job.errors) : [],
    });
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
}

export async function handleImportJobDelete(prisma: PrismaClient, req: Req, res: Res, jobId: string): Promise<void> {
  const user = requireUser(req, res);
  if (!user) return;

  try {
    const job = await prisma.importJob.findUnique({
      where: { id: jobId },
      include: { snapshot: { select: { userId: true } } },
    });
    if (!job) return sendJson(res, 404, { error: 'Job not found.' });
    if (job.snapshot.userId !== user.userId) {
      return sendJson(res, 403, { error: 'Not authorized to delete this job.' });
    }
    if (job.status === 'pending' || job.status === 'processing') {
      return sendJson(res, 409, { error: 'Cannot delete a job that is still running.' });
    }
    await prisma.importJob.delete({ where: { id: jobId } });
    sendJson(res, 200, { ok: true });
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
}

export async function handleImportJobList(prisma: PrismaClient, req: Req, res: Res, url: URL): Promise<void> {
  const user = requireUser(req, res);
  if (!user) return;

  try {
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
    const jobs = await prisma.importJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { snapshot: { select: { name: true, userId: true } } },
    });

    const userJobs = jobs
      .filter(j => j.snapshot.userId === user.userId)
      .map(j => ({
        id: j.id,
        snapshotId: j.snapshotId,
        snapshotName: j.snapshot.name,
        status: j.status,
        progress: j.progress,
        total: j.total,
        resourceTypes: j.resourceTypes ? JSON.parse(j.resourceTypes) : [],
        errors: j.errors ? JSON.parse(j.errors) : [],
        createdAt: j.createdAt.toISOString(),
        updatedAt: j.updatedAt.toISOString(),
      }));

    sendJson(res, 200, userJobs);
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
}

export function handleImportJobStream(
  prisma: PrismaClient,
  req: Req,
  res: Res,
  jobId: string,
  protocol: string,
): void {
  // EventSource API doesn't support custom headers, so support ?token= as fallback.
  const sseUrl = new URL(req.url || '/', `${protocol}://${req.headers.host}`);
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : sseUrl.searchParams.get('token');
  if (!token || !verifyToken(token)) {
    return sendJson(res, 401, { error: 'Authentication required.' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  addSseConnection(jobId, res);

  prisma.importJob.findUnique({ where: { id: jobId } }).then(job => {
    if (job) {
      res.write(`data: ${JSON.stringify({
        status: job.status,
        progress: job.progress,
        total: job.total,
      })}\n\n`);
    }
  });

  req.on('close', () => {
    removeSseConnection(jobId, res);
  });
}
