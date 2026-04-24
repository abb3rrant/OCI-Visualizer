import type { PrismaClient } from '@prisma/client';
import { sendJson, type Req, type Res } from './_common.js';

export async function handleHealth(prisma: PrismaClient, _req: Req, res: Res): Promise<void> {
  let dbStatus = 'disconnected';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch {
    dbStatus = 'disconnected';
  }

  sendJson(res, dbStatus === 'connected' ? 200 : 503, {
    status: dbStatus === 'connected' ? 'healthy' : 'degraded',
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    database: dbStatus,
  });
}
