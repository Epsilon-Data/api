/*
  Warnings:

  - You are about to drop the column `installToken` on the `Proxy` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Proxy_installToken_key";

-- AlterTable
ALTER TABLE "Proxy" DROP COLUMN "installToken";

-- CreateTable
CREATE TABLE "ProxyInstallToken" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" VARCHAR(16) NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(6),

    CONSTRAINT "proxy_install_token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProxyInstallToken_tokenHash_key" ON "ProxyInstallToken"("tokenHash");

-- AddForeignKey
ALTER TABLE "ProxyInstallToken" ADD CONSTRAINT "fk_proxy_install_token_project_id" FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE CASCADE ON UPDATE NO ACTION;
