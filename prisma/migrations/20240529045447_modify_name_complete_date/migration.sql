/*
  Warnings:

  - You are about to drop the column `approveDate` on the `UserRequest` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "UserRequest" DROP COLUMN "approveDate",
ADD COLUMN     "completeDate" DATE;
