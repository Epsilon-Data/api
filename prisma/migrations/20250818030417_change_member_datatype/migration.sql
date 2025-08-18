/*
  Warnings:

  - Changed the type of `members` on the `Project` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "public"."Project" DROP COLUMN "members",
ADD COLUMN     "members" JSON NOT NULL;
