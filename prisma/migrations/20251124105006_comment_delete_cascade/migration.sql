-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "fk_comment_request_id";

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "fk_comment_request_id" FOREIGN KEY ("requestId") REFERENCES "Request"("requestId") ON DELETE CASCADE ON UPDATE NO ACTION;
