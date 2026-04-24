import path from 'path';
import Busboy from 'busboy';
import type { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
import { createImportJob } from '../services/jobQueue.js';
import { sendJson, requireUser, type Req, type Res } from './_common.js';

const MAX_UPLOAD_SIZE = env.MAX_UPLOAD_SIZE_MB * 1024 * 1024;
const MAX_FILE_COUNT = 50;
const ALLOWED_EXTENSIONS = ['.json', '.zip'];

export function handleUpload(prisma: PrismaClient, req: Req, res: Res, snapshotId: string): void {
  const user = requireUser(req, res);
  if (!user) return;
  if (user.role === 'viewer') {
    sendJson(res, 403, { error: 'Viewers cannot upload data.' });
    return;
  }

  prisma.snapshot
    .findUnique({ where: { id: snapshotId } })
    .then((snapshot) => {
      if (!snapshot) return sendJson(res, 404, { error: 'Snapshot not found.' });
      if (snapshot.userId !== user.userId) {
        return sendJson(res, 403, { error: 'Not authorized.' });
      }

      const busboy = Busboy({ headers: req.headers });
      const fileBuffers: Array<{ filename: string; buffer: Buffer }> = [];
      let totalBytes = 0;
      let sizeLimitExceeded = false;
      let fileCount = 0;

      busboy.on('file', (_field: string, file: any, info: { filename: string }) => {
        // Strip any path components to prevent traversal
        const safeName = path.basename(info.filename || '');
        const ext = path.extname(safeName).toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
          file.resume();
          return;
        }
        fileCount++;
        if (fileCount > MAX_FILE_COUNT) {
          file.resume();
          return;
        }
        const chunks: Buffer[] = [];
        file.on('data', (chunk: Buffer) => {
          totalBytes += chunk.length;
          if (totalBytes > MAX_UPLOAD_SIZE) {
            sizeLimitExceeded = true;
            file.destroy();
            req.unpipe(busboy);
            if (!res.headersSent) {
              sendJson(res, 413, { error: `Upload exceeds maximum size of ${env.MAX_UPLOAD_SIZE_MB} MB.` });
            }
            return;
          }
          chunks.push(chunk);
        });
        file.on('end', () => {
          if (!sizeLimitExceeded) {
            fileBuffers.push({ filename: safeName, buffer: Buffer.concat(chunks) });
          }
        });
      });

      busboy.on('finish', async () => {
        if (sizeLimitExceeded) return;
        if (fileCount > MAX_FILE_COUNT) {
          return sendJson(res, 400, { error: `Too many files. Maximum is ${MAX_FILE_COUNT}.` });
        }
        if (fileBuffers.length === 0) {
          return sendJson(res, 400, { error: 'No valid file provided. Only .json and .zip files are accepted.' });
        }
        try {
          const jobId = await createImportJob(prisma, snapshotId, fileBuffers);
          sendJson(res, 202, { jobId });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          sendJson(res, 500, { error: `Failed to create import job: ${message}` });
        }
      });

      busboy.on('error', (err: Error) => {
        sendJson(res, 500, { error: `Upload failed: ${err.message}` });
      });

      req.pipe(busboy);
    })
    .catch((err: Error) => {
      sendJson(res, 500, { error: `Server error: ${err.message}` });
    });
}
