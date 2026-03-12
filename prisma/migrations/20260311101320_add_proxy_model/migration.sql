-- CreateEnum
CREATE TYPE "ConnectionType" AS ENUM ('CLOUD_CONNECT', 'DIRECT_DB', 'PROXY');

-- CreateEnum
CREATE TYPE "ProxyStatus" AS ENUM ('PENDING', 'ONLINE', 'OFFLINE');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "connectionType" "ConnectionType" NOT NULL DEFAULT 'CLOUD_CONNECT';

-- CreateTable
CREATE TABLE "Proxy" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "installToken" TEXT NOT NULL,
    "proxyToken" TEXT,
    "ratholeToken" TEXT,
    "noisePublicKey" TEXT,
    "noisePrivateKey" TEXT,
    "assignedPort" INTEGER,
    "status" "ProxyStatus" NOT NULL DEFAULT 'PENDING',
    "version" TEXT,
    "lastSeenAt" TIMESTAMP(6),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proxy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Proxy_projectId_key" ON "Proxy"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Proxy_installToken_key" ON "Proxy"("installToken");

-- CreateIndex
CREATE UNIQUE INDEX "Proxy_proxyToken_key" ON "Proxy"("proxyToken");

-- CreateIndex
CREATE UNIQUE INDEX "Proxy_assignedPort_key" ON "Proxy"("assignedPort");

-- AddForeignKey
ALTER TABLE "Proxy" ADD CONSTRAINT "fk_proxy_project_id" FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE CASCADE ON UPDATE NO ACTION;
