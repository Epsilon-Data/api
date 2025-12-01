/*
  Warnings:

  - The values [ACTIVE,LINKED] on the enum `ProjectStatus` will be removed. If these variants are still used in the database, this will fail.

*/

-- AlterEnum add new statuses
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.
BEGIN;
ALTER TYPE "ProjectStatus" ADD VALUE 'PENDING';
ALTER TYPE "ProjectStatus" ADD VALUE 'READY';
COMMIT;

-- Update existing data
UPDATE "Project" SET "status" = 'READY' WHERE "status" = 'ACTIVE';

-- AlterEnum
BEGIN;
CREATE TYPE "ProjectStatus_new" AS ENUM ('PENDING', 'CRAWLING', 'ERROR', 'READY', 'MAPPED');
ALTER TABLE "public"."Project" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Project" ALTER COLUMN "status" TYPE "ProjectStatus_new" USING ("status"::text::"ProjectStatus_new");
ALTER TYPE "ProjectStatus" RENAME TO "ProjectStatus_old";
ALTER TYPE "ProjectStatus_new" RENAME TO "ProjectStatus";
DROP TYPE "public"."ProjectStatus_old";
ALTER TABLE "Project" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- DropForeignKey
ALTER TABLE "Connection" DROP CONSTRAINT "fk_connection_project_id";

-- AlterTable
ALTER TABLE "Project" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "fk_connection_project_id" FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE CASCADE ON UPDATE NO ACTION;
