/*
  Warnings:

  - You are about to drop the column `accessPurpose` on the `Analysis` table. All the data in the column will be lost.
  - You are about to drop the column `ethicsId` on the `Analysis` table. All the data in the column will be lost.
  - You are about to drop the column `projectBackground` on the `Analysis` table. All the data in the column will be lost.
  - You are about to drop the column `projectHypotheses` on the `Analysis` table. All the data in the column will be lost.
  - The `projectMembers` column on the `Analysis` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `projectDescription` to the `Analysis` table without a default value. This is not possible if the table is not empty.
  - Added the required column `projectEthicsId` to the `Analysis` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Analysis" DROP COLUMN "accessPurpose",
DROP COLUMN "ethicsId",
DROP COLUMN "projectBackground",
DROP COLUMN "projectHypotheses",
ADD COLUMN     "projectDescription" TEXT NOT NULL,
ADD COLUMN     "projectEthicsId" TEXT NOT NULL,
DROP COLUMN "projectMembers",
ADD COLUMN     "projectMembers" JSON;
