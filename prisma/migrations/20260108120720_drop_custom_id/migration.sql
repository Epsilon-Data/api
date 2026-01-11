/*
  Warnings:

  - You are about to drop the column `customId` on the `Project` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[ownerId,projectId]` on the table `Project` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Project_ownerId_customId_key";

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "customId";

-- CreateIndex
CREATE UNIQUE INDEX "Project_ownerId_projectId_key" ON "Project"("ownerId", "projectId");
