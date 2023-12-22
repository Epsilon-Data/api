-- CreateTable
CREATE TABLE "ConnectionRequest" (
    "id" SMALLSERIAL NOT NULL,
    "requestor" VARCHAR(16),
    "projectId" SMALLINT,
    "status" SMALLINT,
    "dbId" SMALLINT,
    "orgAdminId" SMALLINT,
    "dataParticipantsNum" SMALLINT,
    "dataDescription" VARCHAR(100),
    "dataKeywords" VARCHAR(28),
    "additionalInfo" VARCHAR(32),
    "createdDate" DATE DEFAULT CURRENT_TIMESTAMP,
    "dataCollectionStartDate" DATE,
    "dataCollectionEndDate" DATE,

    CONSTRAINT "request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgAdmin" (
    "id" SMALLSERIAL NOT NULL,
    "email" VARCHAR(17),

    CONSTRAINT "org_admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" SMALLSERIAL NOT NULL,
    "name" VARCHAR(49),
    "lead" VARCHAR(19),
    "members" VARCHAR(100),
    "university" VARCHAR(61),
    "faculty" VARCHAR(16),
    "ethicsId" VARCHAR(11),
    "description" VARCHAR(100),
    "startDate" DATE,
    "endDate" DATE,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearcherDb" (
    "id" SMALLSERIAL NOT NULL,
    "dbName" VARCHAR(13),
    "dbType" VARCHAR(10),

    CONSTRAINT "researcher_db_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ConnectionRequest" ADD CONSTRAINT "fk_request_db_id" FOREIGN KEY ("dbId") REFERENCES "ResearcherDb"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ConnectionRequest" ADD CONSTRAINT "fk_request_org_admin_id" FOREIGN KEY ("orgAdminId") REFERENCES "OrgAdmin"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ConnectionRequest" ADD CONSTRAINT "fk_request_project_id" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

