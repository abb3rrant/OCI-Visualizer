-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Snapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    CONSTRAINT "Resource_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResourceRelation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromResourceId" TEXT NOT NULL,
    "toResourceId" TEXT NOT NULL,
    "relationType" TEXT NOT NULL,
    "metadata" TEXT,
    CONSTRAINT "ResourceRelation_fromResourceId_fkey" FOREIGN KEY ("fromResourceId") REFERENCES "Resource" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ResourceRelation_toResourceId_fkey" FOREIGN KEY ("toResourceId") REFERENCES "Resource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Snapshot_userId_idx" ON "Snapshot"("userId");

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
CREATE UNIQUE INDEX "Resource_ocid_snapshotId_key" ON "Resource"("ocid", "snapshotId");

-- CreateIndex
CREATE INDEX "ResourceRelation_fromResourceId_idx" ON "ResourceRelation"("fromResourceId");

-- CreateIndex
CREATE INDEX "ResourceRelation_toResourceId_idx" ON "ResourceRelation"("toResourceId");

-- CreateIndex
CREATE INDEX "ResourceRelation_relationType_idx" ON "ResourceRelation"("relationType");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceRelation_fromResourceId_toResourceId_relationType_key" ON "ResourceRelation"("fromResourceId", "toResourceId", "relationType");
