-- CreateTable
CREATE TABLE "ResourceBlob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "resourceId" TEXT NOT NULL,
    "blobKey" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    CONSTRAINT "ResourceBlob_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ResourceBlob_resourceId_idx" ON "ResourceBlob"("resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceBlob_resourceId_blobKey_key" ON "ResourceBlob"("resourceId", "blobKey");
