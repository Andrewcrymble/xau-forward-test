-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "niche" TEXT NOT NULL,
    "description" TEXT,
    "targetAudience" TEXT NOT NULL,
    "customAudience" TEXT,
    "trimSize" TEXT NOT NULL DEFAULT '8.5x11',
    "numberOfDesigns" INTEGER NOT NULL,
    "style" TEXT NOT NULL,
    "customStyle" TEXT,
    "complexity" TEXT NOT NULL,
    "complexityOverridden" BOOLEAN NOT NULL DEFAULT false,
    "interiorOptions" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'setup',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ColouringPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "prompt" TEXT NOT NULL DEFAULT '',
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

-- CreateTable
CREATE TABLE "ImageVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pageId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "originalImage" TEXT NOT NULL,
    "processedImage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImageVersion_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "ColouringPage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Cover" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "artwork" TEXT,
    "title" TEXT,
    "subtitle" TEXT,
    "author" TEXT,
    "backCoverText" TEXT,
    "spineText" TEXT,
    "settings" TEXT NOT NULL DEFAULT '{}',
    CONSTRAINT "Cover_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Export" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Export_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GenerationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "estimatedCost" REAL,
    "actualCost" REAL,
    "tokensUsed" INTEGER,
    "imageCount" INTEGER,
    "message" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GenerationLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "ColouringPage_projectId_pageNumber_idx" ON "ColouringPage"("projectId", "pageNumber");

-- CreateIndex
CREATE INDEX "ImageVersion_pageId_versionNumber_idx" ON "ImageVersion"("pageId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Cover_projectId_key" ON "Cover"("projectId");
