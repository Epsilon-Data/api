/*
  Warnings:

  - The `status` column on the `NotificationRecipient` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `senderType` on the `NotificationSender` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "SenderType" AS ENUM ('USER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'DISMISSED');

-- AlterTable
ALTER TABLE "NotificationRecipient" ADD COLUMN     "deliveredAt" TIMESTAMP(3),
DROP COLUMN "status",
ADD COLUMN     "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD';

-- AlterTable
ALTER TABLE "NotificationSender" DROP COLUMN "senderType",
ADD COLUMN     "senderType" "SenderType" NOT NULL;
