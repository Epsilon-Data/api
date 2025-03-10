-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" SMALLINT NOT NULL,

    CONSTRAINT "notify_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationSender" (
    "id" UUID NOT NULL,
    "notificationId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "status" SMALLINT NOT NULL,
    "senderType" VARCHAR(50) NOT NULL,

    CONSTRAINT "notify_sender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationRecipient" (
    "id" UUID NOT NULL,
    "notificationId" UUID NOT NULL,
    "recipientId" UUID NOT NULL,
    "status" SMALLINT NOT NULL,

    CONSTRAINT "notify_recipient_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "NotificationSender" ADD CONSTRAINT "fk_notify_sender_id" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "NotificationRecipient" ADD CONSTRAINT "fk_notify_recipient_id" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
