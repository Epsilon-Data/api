-- CreateTable
CREATE TABLE "ConnectionRequest" (
    "id" UUID NOT NULL,
    "requestor" UUID,
    "projectId" UUID,
    "status" SMALLINT,
    "dbId" UUID,
    "orgAdminId" UUID,
    "dataParticipantsNum" SMALLINT,
    "dataDescription" VARCHAR(500),
    "dataKeywords" TEXT[],
    "additionalInfo" VARCHAR(500),
    "createdDate" DATE DEFAULT CURRENT_TIMESTAMP,
    "dataCollectionStartDate" DATE,
    "dataCollectionEndDate" DATE,
    "userId" UUID,

    CONSTRAINT "request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100),
    "lead" VARCHAR(50),
    "university" VARCHAR(100),
    "faculty" VARCHAR(100),
    "ethicsId" VARCHAR(15),
    "description" VARCHAR(500),
    "startDate" DATE,
    "endDate" DATE,
    "members" TEXT[],

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearcherDb" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50),
    "type" VARCHAR(15),
    "host" VARCHAR(50),
    "port" VARCHAR(15),
    "username" VARCHAR(100),
    "password" VARCHAR(100),
    "status" SMALLINT,
    "connectDate" DATE,

    CONSTRAINT "researcher_db_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "type" CHAR(2) NOT NULL,
    "firstName" VARCHAR(100),
    "lastName" VARCHAR(100),
    "email" VARCHAR(320),
    "gender" CHAR(2),
    "jobTitle" VARCHAR(255),
    "highestQualification" VARCHAR(255),
    "institution" VARCHAR(255),
    "faculty" VARCHAR(255),
    "expertiseArea" VARCHAR(255),
    "orgName" VARCHAR(255),
    "orgDepartment" VARCHAR(255),
    "isAdmin" BOOLEAN,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ConnectionRequest" ADD CONSTRAINT "fk_request_db_id" FOREIGN KEY ("dbId") REFERENCES "ResearcherDb"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ConnectionRequest" ADD CONSTRAINT "fk_request_org_admin_id" FOREIGN KEY ("orgAdminId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ConnectionRequest" ADD CONSTRAINT "fk_request_project_id" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ConnectionRequest" ADD CONSTRAINT "fk_request__id" FOREIGN KEY ("requestor") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

