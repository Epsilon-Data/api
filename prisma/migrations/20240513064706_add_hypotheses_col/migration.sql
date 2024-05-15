/*
  Warnings:

  - Added the required column `projectHypotheses` to the `UserRequest` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "UserRequest" ADD COLUMN     "projectHypotheses" TEXT NOT NULL;
