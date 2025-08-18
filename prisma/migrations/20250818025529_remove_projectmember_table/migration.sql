/*
  Warnings:

  - You are about to drop the `ProjectMember` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ProjectMember" DROP CONSTRAINT "ProjectMember_projectId_fkey";

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "members" TEXT[];

-- DropTable
DROP TABLE "ProjectMember";
