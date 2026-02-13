import { PrismaClient } from '@prisma/client';

interface ResourceRecord {
  id: string;
  ocid: string;
  resourceType: string;
  compartmentId: string | null;
  rawData: string | null;
}

/**
 * Attempt to create (upsert) a single relationship.
 * Silently skips if either side of the relationship is missing.
 */
async function tryCreateRelation(
  prisma: PrismaClient,
  fromResourceId: string,
  toResourceId: string,
  relationType: string,
  metadata?: Record<string, any>,
): Promise<boolean> {
  if (!fromResourceId || !toResourceId) return false;

  try {
    await prisma.resourceRelation.upsert({
      where: {
        fromResourceId_toResourceId_relationType: {
          fromResourceId,
          toResourceId,
          relationType,
        },
      },
      update: {
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
      create: {
        fromResourceId,
        toResourceId,
        relationType,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
    return true;
  } catch {
    // Skip gracefully — the referenced resource may not exist in this snapshot
    return false;
  }
}

/**
 * Build all discoverable relationships between resources in a snapshot.
 *
 * This function inspects rawData on each resource and creates typed edges
 * (ResourceRelation rows) based on OCI reference fields.
 *
 * Returns the total number of relationships created.
 */
export async function buildRelationships(
  prisma: PrismaClient,
  snapshotId: string,
): Promise<number> {
  // Load all resources for this snapshot
  const resources = (await prisma.resource.findMany({
    where: { snapshotId },
    select: {
      id: true,
      ocid: true,
      resourceType: true,
      compartmentId: true,
      rawData: true,
    },
  })) as ResourceRecord[];

  // Build a lookup map: OCID → resource DB id
  const ocidToId = new Map<string, string>();
  for (const r of resources) {
    ocidToId.set(r.ocid, r.id);
  }

  let created = 0;

  for (const resource of resources) {
    let rawData: Record<string, any> = {};
    if (resource.rawData) {
      try {
        rawData = JSON.parse(resource.rawData);
      } catch {
        continue;
      }
    }

    const resId = resource.id;
    const resType = resource.resourceType;

    // ---------------------------------------------------------------
    // Compartment "contains" — every resource belongs to a compartment
    // ---------------------------------------------------------------
    if (resource.compartmentId) {
      const compartmentDbId = ocidToId.get(resource.compartmentId);
      if (compartmentDbId && compartmentDbId !== resId) {
        if (await tryCreateRelation(prisma, compartmentDbId, resId, 'contains')) {
          created++;
        }
      }
    }

    // ---------------------------------------------------------------
    // Compartment parent hierarchy
    // ---------------------------------------------------------------
    if (resType === 'iam/compartment' && resource.compartmentId) {
      const parentDbId = ocidToId.get(resource.compartmentId);
      if (parentDbId && parentDbId !== resId) {
        if (await tryCreateRelation(prisma, parentDbId, resId, 'parent')) {
          created++;
        }
      }
    }

    // ---------------------------------------------------------------
    // VCN contains subnet
    // ---------------------------------------------------------------
    if (resType === 'network/subnet' && rawData.vcnId) {
      const vcnDbId = ocidToId.get(rawData.vcnId);
      if (vcnDbId) {
        if (await tryCreateRelation(prisma, vcnDbId, resId, 'contains')) {
          created++;
        }
      }
    }

    // ---------------------------------------------------------------
    // Subnet membership — resources with subnetId or subnetIds
    // ---------------------------------------------------------------
    if (rawData.subnetId) {
      const subnetDbId = ocidToId.get(rawData.subnetId);
      if (subnetDbId) {
        if (await tryCreateRelation(prisma, resId, subnetDbId, 'subnet-member')) {
          created++;
        }
      }
    }
    if (Array.isArray(rawData.subnetIds)) {
      for (const sid of rawData.subnetIds) {
        const subnetDbId = ocidToId.get(sid);
        if (subnetDbId) {
          if (await tryCreateRelation(prisma, resId, subnetDbId, 'subnet-member')) {
            created++;
          }
        }
      }
    }

    // ---------------------------------------------------------------
    // Routes-via — subnet → route table
    // ---------------------------------------------------------------
    if (resType === 'network/subnet' && rawData.routeTableId) {
      const rtDbId = ocidToId.get(rawData.routeTableId);
      if (rtDbId) {
        if (await tryCreateRelation(prisma, resId, rtDbId, 'routes-via')) {
          created++;
        }
      }
    }

    // ---------------------------------------------------------------
    // Secured-by — subnet → security lists
    // ---------------------------------------------------------------
    if (resType === 'network/subnet' && Array.isArray(rawData.securityListIds)) {
      for (const slId of rawData.securityListIds) {
        const slDbId = ocidToId.get(slId);
        if (slDbId) {
          if (await tryCreateRelation(prisma, resId, slDbId, 'secured-by')) {
            created++;
          }
        }
      }
    }

    // ---------------------------------------------------------------
    // NSG membership — resources with nsgIds or networkSecurityGroupIds
    // ---------------------------------------------------------------
    const nsgIdList = rawData.nsgIds ?? rawData.networkSecurityGroupIds;
    if (Array.isArray(nsgIdList)) {
      for (const nsgId of nsgIdList) {
        const nsgDbId = ocidToId.get(nsgId);
        if (nsgDbId) {
          if (await tryCreateRelation(prisma, resId, nsgDbId, 'nsg-member')) {
            created++;
          }
        }
      }
    }

    // ---------------------------------------------------------------
    // Volume-attached — boot/block volume attachments
    // ---------------------------------------------------------------
    if (
      (resType === 'compute/boot-volume-attachment' || resType === 'compute/volume-attachment') &&
      rawData.instanceId
    ) {
      const instanceDbId = ocidToId.get(rawData.instanceId);
      const volumeOcid = rawData.bootVolumeId || rawData.volumeId;
      const volumeDbId = volumeOcid ? ocidToId.get(volumeOcid) : undefined;

      if (instanceDbId && volumeDbId) {
        if (await tryCreateRelation(prisma, instanceDbId, volumeDbId, 'volume-attached')) {
          created++;
        }
      }
    }

    // ---------------------------------------------------------------
    // LB backend — load balancer → backend instances
    // ---------------------------------------------------------------
    if (resType === 'network/load-balancer' && rawData.backendSets) {
      const backendSets =
        typeof rawData.backendSets === 'string'
          ? JSON.parse(rawData.backendSets)
          : rawData.backendSets;

      for (const bsName of Object.keys(backendSets)) {
        const bs = backendSets[bsName];
        if (Array.isArray(bs.backends)) {
          for (const backend of bs.backends) {
            // Backends may reference an instance via the ipAddress or name field
            // but more reliably via an OCID if present
            const targetOcid = backend.instanceId || backend.targetId;
            if (targetOcid) {
              const targetDbId = ocidToId.get(targetOcid);
              if (targetDbId) {
                if (
                  await tryCreateRelation(prisma, resId, targetDbId, 'lb-backend', {
                    backendSet: bsName,
                  })
                ) {
                  created++;
                }
              }
            }
          }
        }
      }
    }

    // ---------------------------------------------------------------
    // Gateway-for — gateways linked to a VCN
    // ---------------------------------------------------------------
    const gatewayTypes = [
      'network/internet-gateway',
      'network/nat-gateway',
      'network/service-gateway',
      'network/local-peering-gateway',
      'network/drg-attachment',
    ];
    if (gatewayTypes.includes(resType) && rawData.vcnId) {
      const vcnDbId = ocidToId.get(rawData.vcnId);
      if (vcnDbId) {
        if (await tryCreateRelation(prisma, resId, vcnDbId, 'gateway-for')) {
          created++;
        }
      }
    }

    // ---------------------------------------------------------------
    // Runs-in — function → application
    // ---------------------------------------------------------------
    if (resType === 'serverless/function' && rawData.applicationId) {
      const appDbId = ocidToId.get(rawData.applicationId);
      if (appDbId) {
        if (await tryCreateRelation(prisma, resId, appDbId, 'runs-in')) {
          created++;
        }
      }
    }

    // ---------------------------------------------------------------
    // Uses-vcn — OKE cluster → VCN
    // ---------------------------------------------------------------
    if (resType === 'container/cluster' && rawData.vcnId) {
      const vcnDbId = ocidToId.get(rawData.vcnId);
      if (vcnDbId) {
        if (await tryCreateRelation(prisma, resId, vcnDbId, 'uses-vcn')) {
          created++;
        }
      }
    }

    // ---------------------------------------------------------------
    // Uses-image — instance → image
    // ---------------------------------------------------------------
    if (resType === 'compute/instance' && rawData.imageId) {
      const imageDbId = ocidToId.get(rawData.imageId);
      if (imageDbId) {
        if (await tryCreateRelation(prisma, resId, imageDbId, 'uses-image')) {
          created++;
        }
      }
    }

    // ---------------------------------------------------------------
    // Node pool → cluster (member-of)
    // ---------------------------------------------------------------
    if (resType === 'container/node-pool' && rawData.clusterId) {
      const clusterDbId = ocidToId.get(rawData.clusterId);
      if (clusterDbId) {
        if (await tryCreateRelation(prisma, resId, clusterDbId, 'member-of')) {
          created++;
        }
      }
    }

    // ---------------------------------------------------------------
    // Container image → repository (stored-in)
    // ---------------------------------------------------------------
    if (resType === 'container/container-image' && rawData.repositoryId) {
      const repoDbId = ocidToId.get(rawData.repositoryId);
      if (repoDbId) {
        if (await tryCreateRelation(prisma, resId, repoDbId, 'stored-in')) {
          created++;
        }
      }
    }

    // ---------------------------------------------------------------
    // API deployment → gateway (deployed-to)
    // ---------------------------------------------------------------
    if (resType === 'serverless/api-deployment' && rawData.gatewayId) {
      const gwDbId = ocidToId.get(rawData.gatewayId);
      if (gwDbId) {
        if (await tryCreateRelation(prisma, resId, gwDbId, 'deployed-to')) {
          created++;
        }
      }
    }

    // ---------------------------------------------------------------
    // DB home → DB system (member-of)
    // ---------------------------------------------------------------
    if (resType === 'database/db-home' && rawData.dbSystemId) {
      const dbSysDbId = ocidToId.get(rawData.dbSystemId);
      if (dbSysDbId) {
        if (await tryCreateRelation(prisma, resId, dbSysDbId, 'member-of')) {
          created++;
        }
      }
    }

    // ---------------------------------------------------------------
    // Volume backup → volume (backup-of)
    // ---------------------------------------------------------------
    if (resType === 'storage/volume-backup' && rawData.volumeId) {
      const volDbId = ocidToId.get(rawData.volumeId);
      if (volDbId) {
        if (await tryCreateRelation(prisma, resId, volDbId, 'backup-of')) {
          created++;
        }
      }
    }

    // ---------------------------------------------------------------
    // Volume group → volumes (groups)
    // ---------------------------------------------------------------
    if (resType === 'storage/volume-group' && Array.isArray(rawData.volumeIds)) {
      for (const vid of rawData.volumeIds) {
        const volDbId = ocidToId.get(vid);
        if (volDbId) {
          if (await tryCreateRelation(prisma, resId, volDbId, 'groups')) {
            created++;
          }
        }
      }
    }

    // ---------------------------------------------------------------
    // Container instance → subnet (via vnics)
    // ---------------------------------------------------------------
    if (resType === 'container/container-instance' && Array.isArray(rawData.vnics)) {
      for (const vnic of rawData.vnics) {
        if (vnic?.subnetId) {
          const subnetDbId = ocidToId.get(vnic.subnetId);
          if (subnetDbId) {
            if (await tryCreateRelation(prisma, resId, subnetDbId, 'subnet-member')) {
              created++;
            }
          }
        }
      }
    }

    // ---------------------------------------------------------------
    // Node pool → subnet (via nodeConfigDetails.placementConfigs)
    // ---------------------------------------------------------------
    if (resType === 'container/node-pool' && rawData.nodeConfigDetails?.placementConfigs) {
      const configs = rawData.nodeConfigDetails.placementConfigs;
      if (Array.isArray(configs)) {
        for (const pc of configs) {
          if (pc?.subnetId) {
            const subnetDbId = ocidToId.get(pc.subnetId);
            if (subnetDbId) {
              if (await tryCreateRelation(prisma, resId, subnetDbId, 'subnet-member')) {
                created++;
              }
            }
          }
        }
      }
    }

    // ---------------------------------------------------------------
    // DRG attachment → DRG (attached-to)
    // ---------------------------------------------------------------
    if (resType === 'network/drg-attachment' && rawData.drgId) {
      const drgDbId = ocidToId.get(rawData.drgId);
      if (drgDbId) {
        if (await tryCreateRelation(prisma, resId, drgDbId, 'attached-to')) {
          created++;
        }
      }
    }

    // ---------------------------------------------------------------
    // DRG attachment → VCN (gateway-for)
    // ---------------------------------------------------------------
    if (resType === 'network/drg-attachment' && rawData.vcnId) {
      const vcnDbId = ocidToId.get(rawData.vcnId);
      if (vcnDbId) {
        if (await tryCreateRelation(prisma, resId, vcnDbId, 'gateway-for')) {
          created++;
        }
      }
    }
  }

  return created;
}
