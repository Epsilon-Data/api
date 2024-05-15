/*
  Warnings:

  - Added the required column `status` to the `UserRequest` table without a default value. This is not possible if the table is not empty.
  - Made the column `projectStartDate` on table `UserRequest` required. This step will fail if there are existing NULL values in that column.
  - Made the column `projectEndDate` on table `UserRequest` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "UserRequest" ADD COLUMN     "status" SMALLINT NOT NULL,
ALTER COLUMN "projectStartDate" SET NOT NULL,
ALTER COLUMN "projectEndDate" SET NOT NULL;
