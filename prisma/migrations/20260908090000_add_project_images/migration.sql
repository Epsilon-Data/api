-- CreateTable
CREATE TABLE "ProjectImage" (
    "imageId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdDate" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_image_pkey" PRIMARY KEY ("imageId")
);

-- CreateIndex
CREATE INDEX "ProjectImage_projectId_idx" ON "ProjectImage"("projectId");

-- AddForeignKey
ALTER TABLE "ProjectImage" ADD CONSTRAINT "fk_project_image_project_id" FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE CASCADE ON UPDATE NO ACTION;