-- CreateTable
CREATE TABLE "ConnectionRequest" (
    "id" UUID NOT NULL,
    "requestor" UUID,
    "projectId" UUID,
    "status" SMALLINT,
    "dbName" TEXT,
    "orgAdminEmail" TEXT,
    "dataParticipantsNum" SMALLINT,
    "dataDescription" TEXT,
    "dataKeywords" TEXT[],
    "additionalInfo" TEXT,
    "createdDate" DATE DEFAULT CURRENT_TIMESTAMP,
    "dataCollectionStartDate" DATE,
    "dataCollectionEndDate" DATE,
    "revisionInfo" TEXT,
    "cover" BYTEA,
    "visualisations" JSONB,

    CONSTRAINT "request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "customId" TEXT,
    "name" TEXT,
    "lead" TEXT,
    "university" TEXT,
    "faculty" TEXT,
    "ethicsId" TEXT,
    "description" TEXT,
    "startDate" DATE,
    "endDate" DATE,
    "members" TEXT[],

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConnectionRequest_projectId_key" ON "ConnectionRequest"("projectId");

-- AddForeignKey
ALTER TABLE "ConnectionRequest" ADD CONSTRAINT "fk_request_project_id" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

