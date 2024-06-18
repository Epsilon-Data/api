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
    "cover" BYTEA,
    "visualisations" JSONB,
    "lastUpdated" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRequest" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "accessPurpose" TEXT NOT NULL,
    "requestor" UUID NOT NULL,
    "requestorName" TEXT NOT NULL,
    "requestorEmail" TEXT NOT NULL,
    "requestorOrgName" TEXT NOT NULL,
    "requestorPosition" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "projectStartDate" DATE NOT NULL,
    "projectEndDate" DATE NOT NULL,
    "projectBackground" TEXT NOT NULL,
    "projectObjective" TEXT NOT NULL,
    "projectHypotheses" TEXT NOT NULL,
    "projectOutcome" TEXT NOT NULL,
    "projectMembers" TEXT[],
    "ethicsId" TEXT NOT NULL,
    "status" SMALLINT NOT NULL,
    "createdDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revisionInfo" TEXT,
    "completeDate" DATE,

    CONSTRAINT "user_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Analysis" (
    "id" UUID NOT NULL,
    "userRequestId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdated" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedUser" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Script" (
    "id" UUID NOT NULL,
    "analysisId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" SMALLINT NOT NULL,
    "statusMsg" TEXT NOT NULL,
    "lastUpdated" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedUser" TEXT NOT NULL,
    "executionSettings" JSONB,
    "script" BYTEA,

    CONSTRAINT "scripts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConnectionRequest_projectId_key" ON "ConnectionRequest"("projectId");

-- AddForeignKey
ALTER TABLE "ConnectionRequest" ADD CONSTRAINT "fk_request_project_id" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "UserRequest" ADD CONSTRAINT "fk_user_request_project_id" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Analysis" ADD CONSTRAINT "fk_analysis_user_request_id" FOREIGN KEY ("userRequestId") REFERENCES "UserRequest"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Script" ADD CONSTRAINT "fk_script_analysis_id" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

