/*
  Warnings:

  - The required column `id` was added to the `Connection` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
-- add id  column as nullable
ALTER TABLE "Connection" ADD COLUMN "id" UUID;

-- backfill existing rows with a UUID
UPDATE "Connection" SET "id" = gen_random_uuid() WHERE "id" IS NULL;


-- make id into key
ALTER TABLE "Connection" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "Connection" ADD CONSTRAINT "connection_pkey" PRIMARY KEY ("id");
