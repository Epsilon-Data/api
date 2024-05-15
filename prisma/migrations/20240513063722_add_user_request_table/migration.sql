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
    "projectStartDate" DATE,
    "projectEndDate" DATE,
    "projectBackground" TEXT NOT NULL,
    "projectObjective" TEXT NOT NULL,
    "projectOutcome" TEXT NOT NULL,
    "projectMembers" TEXT[],
    "ethicsId" TEXT NOT NULL,

    CONSTRAINT "user_request_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "UserRequest" ADD CONSTRAINT "fk_user_request_project_id" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
