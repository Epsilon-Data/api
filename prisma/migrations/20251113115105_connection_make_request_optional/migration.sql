/*
  Warnings:

  - The primary key for the `Connection` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[requestId]` on the table `Connection` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Connection" DROP CONSTRAINT "Connection_pkey",
ALTER COLUMN "requestId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Connection_requestId_key" ON "Connection"("requestId");
