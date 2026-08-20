-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "syntheticDataColumns" JSON,
ADD COLUMN     "syntheticDataSchemaHash" TEXT,
ADD COLUMN     "syntheticDataVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "syntheticDataRowCount" INTEGER;
