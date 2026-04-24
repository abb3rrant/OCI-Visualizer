import type { PrismaClient } from '@prisma/client';
import { verifyToken } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { sendJson, type Req, type Res } from './_common.js';

const CHUNK = 2000;
const IMAGE_CHUNK = 500;

function csvEscape(v: any): string {
  const s = v == null ? '' : String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function csvRow(...fields: any[]): string {
  return fields.map(csvEscape).join(',') + '\n';
}

export async function handleComputeCsvExport(prisma: PrismaClient, req: Req, res: Res, url: URL): Promise<void> {
  const authHeader = Array.isArray(req.headers.authorization)
    ? req.headers.authorization[0]
    : req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const user = token ? verifyToken(token) : null;
  if (!user) return sendJson(res, 401, { error: 'Unauthorized' });

  const snapshotId = url.searchParams.get('snapshotId') || '';
  const compartmentId = url.searchParams.get('compartmentId') || undefined;
  const lifecycleState = url.searchParams.get('lifecycleState') || undefined;
  const search = url.searchParams.get('search') || undefined;

  if (!snapshotId) return sendJson(res, 400, { error: 'snapshotId required' });

  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="compute-instances.csv"',
    'Transfer-Encoding': 'chunked',
    'Cache-Control': 'no-cache',
  });

  res.write(csvRow(
    'Name', 'Shape', 'State', 'Sys Init Image',
    'Fault Domain', 'AD', 'Region', 'Compartment ID',
    'Image Name', 'OS', 'OS Version', 'Image OCID', 'OCID', 'Created',
  ));

  try {
    const where: Record<string, any> = { snapshotId, resourceType: 'compute/instance' };
    if (compartmentId) where.compartmentId = compartmentId;
    if (lifecycleState) where.lifecycleState = lifecycleState;
    if (search) {
      where.OR = [
        { displayName: { contains: search } },
        { ocid: { contains: search } },
        { freeformTags: { contains: search } },
        { rawData: { contains: search } },
      ];
    }

    let cursor: string | undefined;

    while (true) {
      const findArgs: any = {
        where,
        take: CHUNK,
        orderBy: { id: 'asc' as const },
        select: {
          id: true, ocid: true, displayName: true, lifecycleState: true,
          availabilityDomain: true, regionKey: true, compartmentId: true,
          timeCreated: true, rawData: true, freeformTags: true,
        },
      };
      if (cursor) { findArgs.cursor = { id: cursor }; findArgs.skip = 1; }

      const instances = await prisma.resource.findMany(findArgs);
      if (instances.length === 0) break;

      const imageOcids = new Set<string>();
      const parsedRaws = instances.map((inst: any) => {
        const raw = inst.rawData ? (() => { try { return JSON.parse(inst.rawData); } catch { return {}; } })() : {};
        const imageId = raw?.imageId || raw?.sourceDetails?.imageId;
        if (imageId) imageOcids.add(imageId);
        return raw;
      });

      const imageOcidArray = Array.from(imageOcids);
      const imageRows: any[] = [];
      for (let i = 0; i < imageOcidArray.length; i += IMAGE_CHUNK) {
        const batch = await prisma.resource.findMany({
          where: { snapshotId, ocid: { in: imageOcidArray.slice(i, i + IMAGE_CHUNK) } },
          select: { ocid: true, displayName: true, rawData: true },
        });
        imageRows.push(...batch);
      }
      const imageMap = new Map(imageRows.map((img: any) => [img.ocid, img]));

      for (let i = 0; i < instances.length; i++) {
        const inst = instances[i] as any;
        const raw = parsedRaws[i];
        const imageId = raw?.imageId || raw?.sourceDetails?.imageId;
        const image = imageId ? imageMap.get(imageId) : null;
        const imageRaw = image?.rawData ? (() => { try { return JSON.parse(image.rawData); } catch { return {}; } })() : {};
        const ft = inst.freeformTags ? (() => { try { return JSON.parse(inst.freeformTags); } catch { return {}; } })() : {};
        const sysInitImage = ft?.sys_init_image ?? ft?.['sys-init-image'] ?? raw?.metadata?.sysInitImage ?? raw?.metadata?.sys_init_image ?? null;

        res.write(csvRow(
          inst.displayName, raw?.shape, inst.lifecycleState, sysInitImage,
          raw?.faultDomain, inst.availabilityDomain, inst.regionKey, inst.compartmentId,
          image?.displayName, imageRaw?.operatingSystem, imageRaw?.operatingSystemVersion,
          imageId, inst.ocid, inst.timeCreated,
        ));
      }

      if (instances.length < CHUNK) break;
      cursor = instances[instances.length - 1].id;
    }
  } catch (err) {
    logger.error('CSV export error', { error: String(err) });
  }

  res.end();
}
