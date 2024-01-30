-- CreateTable
CREATE TABLE "User" (
    "id" SMALLSERIAL NOT NULL,
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

-- CreateTable
CREATE TABLE "Template" (
    "id" SMALLSERIAL NOT NULL,
    "researcherDbId" SMALLINT NOT NULL,
    "hierarchicalData" JSON NOT NULL,

    CONSTRAINT "template_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "fk_template_db_id" FOREIGN KEY ("researcherDbId") REFERENCES "ResearcherDb"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
