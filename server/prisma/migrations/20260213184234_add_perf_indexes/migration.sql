-- CreateIndex
CREATE INDEX "ImportJob_snapshotId_idx" ON "ImportJob"("snapshotId");

-- CreateIndex
CREATE INDEX "ResourceRelation_fromResourceId_relationType_idx" ON "ResourceRelation"("fromResourceId", "relationType");

-- CreateIndex
CREATE INDEX "ResourceRelation_toResourceId_relationType_idx" ON "ResourceRelation"("toResourceId", "relationType");
