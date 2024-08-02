/*
  Warnings:

  - A unique constraint covering the columns `[analysisId,name]` on the table `Script` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Script_analysisId_name_key" ON "Script"("analysisId", "name");
