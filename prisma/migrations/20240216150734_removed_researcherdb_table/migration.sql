/*
  Warnings:

  - You are about to drop the `ResearcherDb` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ConnectionRequest" DROP CONSTRAINT "fk_request_db_id";

-- DropTable
DROP TABLE "ResearcherDb";
