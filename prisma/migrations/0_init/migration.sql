-- CreateEnum
CREATE TYPE "SenderType" AS ENUM ('USER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('CRAWLING', 'ACTIVE', 'MAPPED', 'LINKED');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED');

-- CreateTable
CREATE TABLE "Request" (
    "requestId" UUID NOT NULL,
    "requestorId" UUID NOT NULL,
    "lastModified" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "request_pkey" PRIMARY KEY ("requestId")
);

-- CreateTable
CREATE TABLE "Comment" (
    "commentId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "createdDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_pkey" PRIMARY KEY ("commentId")
);

-- CreateTable
CREATE TABLE "Connection" (
    "requestId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "atlasId" UUID,
    "orgAdminEmail" TEXT,
    "tempDbDetails" JSON,

    CONSTRAINT "Connection_pkey" PRIMARY KEY ("requestId")
);

-- CreateTable
CREATE TABLE "Analysis" (
    "requestId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "accessPurpose" TEXT NOT NULL,
    "requestorName" TEXT NOT NULL,
    "requestorEmail" TEXT NOT NULL,
    "requestorOrgName" TEXT NOT NULL,
    "requestorPosition" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "projectStartDate" DATE NOT NULL,
    "projectEndDate" DATE NOT NULL,
    "projectBackground" TEXT NOT NULL,
    "projectObjective" TEXT NOT NULL,
    "projectHypotheses" TEXT NOT NULL,
    "projectOutcome" TEXT NOT NULL,
    "projectMembers" TEXT[],
    "ethicsId" TEXT NOT NULL,

    CONSTRAINT "Analysis_pkey" PRIMARY KEY ("requestId")
);

-- CreateTable
CREATE TABLE "Project" (
    "projectId" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "customId" VARCHAR(6) NOT NULL,
    "name" TEXT NOT NULL,
    "lead" TEXT NOT NULL,
    "university" TEXT NOT NULL,
    "faculty" TEXT NOT NULL,
    "ethicsId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "members" TEXT[],
    "lastUpdated" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dbCollectionStartDate" DATE NOT NULL,
    "dbCollectionEndDate" DATE NOT NULL,
    "dbParticipantsNum" SMALLINT NOT NULL,
    "dbDescription" TEXT NOT NULL,
    "dbKeywords" TEXT[],
    "createdDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visualizations" JSON,
    "status" "ProjectStatus" NOT NULL DEFAULT 'CRAWLING',

    CONSTRAINT "project_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "Notification" (
    "notificationId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" SMALLINT NOT NULL,
    "createdDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notify_pkey" PRIMARY KEY ("notificationId")
);

-- CreateTable
CREATE TABLE "NotificationSender" (
    "notificationId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "status" SMALLINT NOT NULL,
    "senderType" "SenderType" NOT NULL,

    CONSTRAINT "NotificationSender_pkey" PRIMARY KEY ("notificationId","senderId")
);

-- CreateTable
CREATE TABLE "NotificationRecipient" (
    "notificationId" UUID NOT NULL,
    "recipientId" UUID NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "NotificationRecipient_pkey" PRIMARY KEY ("notificationId","recipientId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Connection_projectId_key" ON "Connection"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_ownerId_customId_key" ON "Project"("ownerId", "customId");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "fk_comment_request_id" FOREIGN KEY ("requestId") REFERENCES "Request"("requestId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "fk_connection_request_id" FOREIGN KEY ("requestId") REFERENCES "Request"("requestId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "fk_connection_project_id" FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Analysis" ADD CONSTRAINT "fk_analysis_request_id" FOREIGN KEY ("requestId") REFERENCES "Request"("requestId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Analysis" ADD CONSTRAINT "fk_analysis_project_id" FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "NotificationSender" ADD CONSTRAINT "fk_notify_sender_id" FOREIGN KEY ("notificationId") REFERENCES "Notification"("notificationId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "NotificationRecipient" ADD CONSTRAINT "fk_notify_recipient_id" FOREIGN KEY ("notificationId") REFERENCES "Notification"("notificationId") ON DELETE NO ACTION ON UPDATE NO ACTION;

