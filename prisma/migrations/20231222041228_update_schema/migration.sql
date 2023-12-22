/*
  Warnings:

  - The `dataKeywords` column on the `ConnectionRequest` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "ConnectionRequest" ALTER COLUMN "requestor" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "dataDescription" SET DATA TYPE VARCHAR(500),
DROP COLUMN "dataKeywords",
ADD COLUMN     "dataKeywords" TEXT[],
ALTER COLUMN "additionalInfo" SET DATA TYPE VARCHAR(500);

-- AlterTable
ALTER TABLE "Project" ALTER COLUMN "name" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "lead" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "university" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "faculty" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "ethicsId" SET DATA TYPE VARCHAR(15),
ALTER COLUMN "description" SET DATA TYPE VARCHAR(500);

-- AlterTable
ALTER TABLE "ResearcherDb" ALTER COLUMN "dbName" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "dbType" SET DATA TYPE VARCHAR(15);
