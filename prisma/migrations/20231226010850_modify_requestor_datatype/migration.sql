/*
  Warnings:

  - The `requestor` column on the `ConnectionRequest` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "ConnectionRequest" DROP COLUMN "requestor",
ADD COLUMN     "requestor" SMALLINT;
