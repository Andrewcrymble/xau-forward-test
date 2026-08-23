-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ColouringPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "prompt" TEXT NOT NULL DEFAULT '',
    "promptEdited" BOOLEAN NOT NULL DEFAULT false,
    "originalImage" TEXT,
    "processedImage" TEXT,
    "generationStatus" TEXT NOT NULL DEFAULT 'planned',
    "approvalStatus" TEXT NOT NULL DEFAULT 'pending',
    "validationStatus" TEXT NOT NULL DEFAULT 'not_checked',
    "generationAttempts" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ColouringPage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ColouringPage" ("approvalStatus", "concept", "createdAt", "generationAttempts", "generationStatus", "id", "notes", "originalImage", "pageNumber", "processedImage", "projectId", "prompt", "title", "updatedAt", "validationStatus") SELECT "approvalStatus", "concept", "createdAt", "generationAttempts", "generationStatus", "id", "notes", "originalImage", "pageNumber", "processedImage", "projectId", "prompt", "title", "updatedAt", "validationStatus" FROM "ColouringPage";
DROP TABLE "ColouringPage";
ALTER TABLE "new_ColouringPage" RENAME TO "ColouringPage";
CREATE INDEX "ColouringPage_projectId_pageNumber_idx" ON "ColouringPage"("projectId", "pageNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
