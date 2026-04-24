-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "teamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaRequired" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "mfaBackupCodes" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "ocid" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "displayName" TEXT,
    "compartmentId" TEXT,
    "lifecycleState" TEXT,
    "availabilityDomain" TEXT,
    "regionKey" TEXT,
    "timeCreated" TEXT,
    "definedTags" TEXT,
    "freeformTags" TEXT,
    "rawData" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "resourceTypes" TEXT,
    "errors" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceBlob" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "blobKey" TEXT NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "ResourceBlob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceRelation" (
    "id" TEXT NOT NULL,
    "fromResourceId" TEXT NOT NULL,
    "toResourceId" TEXT NOT NULL,
    "relationType" TEXT NOT NULL,
    "metadata" TEXT,

    CONSTRAINT "ResourceRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "resourceType" TEXT NOT NULL,
    "fieldPath" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "value" TEXT,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "recommendation" TEXT,
    "category" TEXT NOT NULL DEFAULT 'Custom',
    "framework" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_teamId_idx" ON "User"("teamId");

-- CreateIndex
CREATE INDEX "Snapshot_userId_idx" ON "Snapshot"("userId");

-- CreateIndex
CREATE INDEX "Snapshot_isShared_importedAt_idx" ON "Snapshot"("isShared", "importedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Resource_ocid_snapshotId_key" ON "Resource"("ocid", "snapshotId");

-- CreateIndex
CREATE INDEX "Resource_resourceType_idx" ON "Resource"("resourceType");

-- CreateIndex
CREATE INDEX "Resource_compartmentId_idx" ON "Resource"("compartmentId");

-- CreateIndex
CREATE INDEX "Resource_snapshotId_idx" ON "Resource"("snapshotId");

-- CreateIndex
CREATE INDEX "Resource_lifecycleState_idx" ON "Resource"("lifecycleState");

-- CreateIndex
CREATE INDEX "Resource_displayName_idx" ON "Resource"("displayName");

-- CreateIndex
CREATE INDEX "Resource_snapshotId_resourceType_idx" ON "Resource"("snapshotId", "resourceType");

-- CreateIndex
CREATE INDEX "Resource_snapshotId_compartmentId_idx" ON "Resource"("snapshotId", "compartmentId");

-- CreateIndex
CREATE INDEX "Resource_snapshotId_lifecycleState_idx" ON "Resource"("snapshotId", "lifecycleState");

-- CreateIndex
CREATE INDEX "ImportJob_snapshotId_idx" ON "ImportJob"("snapshotId");

-- CreateIndex
CREATE INDEX "ImportJob_status_idx" ON "ImportJob"("status");

-- CreateIndex
CREATE INDEX "ImportJob_snapshotId_status_idx" ON "ImportJob"("snapshotId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceBlob_resourceId_blobKey_key" ON "ResourceBlob"("resourceId", "blobKey");

-- CreateIndex
CREATE INDEX "ResourceBlob_resourceId_idx" ON "ResourceBlob"("resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceRelation_fromResourceId_toResourceId_relationType_key" ON "ResourceRelation"("fromResourceId", "toResourceId", "relationType");

-- CreateIndex
CREATE INDEX "ResourceRelation_fromResourceId_idx" ON "ResourceRelation"("fromResourceId");

-- CreateIndex
CREATE INDEX "ResourceRelation_toResourceId_idx" ON "ResourceRelation"("toResourceId");

-- CreateIndex
CREATE INDEX "ResourceRelation_relationType_idx" ON "ResourceRelation"("relationType");

-- CreateIndex
CREATE INDEX "ResourceRelation_fromResourceId_relationType_idx" ON "ResourceRelation"("fromResourceId", "relationType");

-- CreateIndex
CREATE INDEX "ResourceRelation_toResourceId_relationType_idx" ON "ResourceRelation"("toResourceId", "relationType");

-- CreateIndex
CREATE INDEX "AuditRule_userId_idx" ON "AuditRule"("userId");

-- CreateIndex
CREATE INDEX "AuditRule_userId_enabled_idx" ON "AuditRule"("userId", "enabled");

-- CreateIndex
CREATE INDEX "AuditRule_userId_createdAt_idx" ON "AuditRule"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceBlob" ADD CONSTRAINT "ResourceBlob_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRelation" ADD CONSTRAINT "ResourceRelation_fromResourceId_fkey" FOREIGN KEY ("fromResourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRelation" ADD CONSTRAINT "ResourceRelation_toResourceId_fkey" FOREIGN KEY ("toResourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditRule" ADD CONSTRAINT "AuditRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
