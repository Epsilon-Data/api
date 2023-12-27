/*
  Warnings:

  - You are about to drop the column `dbName` on the `ResearcherDb` table. All the data in the column will be lost.
  - You are about to drop the column `dbType` on the `ResearcherDb` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ResearcherDb" DROP COLUMN "dbName",
DROP COLUMN "dbType",
ADD COLUMN     "name" VARCHAR(50),
ADD COLUMN     "type" VARCHAR(15);
