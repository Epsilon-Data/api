-- DropForeignKey
ALTER TABLE "Analysis" DROP CONSTRAINT "fk_analysis_project_id";

-- DropForeignKey
ALTER TABLE "Analysis" DROP CONSTRAINT "fk_analysis_request_id";

-- AddForeignKey
ALTER TABLE "Analysis" ADD CONSTRAINT "fk_analysis_request_id" FOREIGN KEY ("requestId") REFERENCES "Request"("requestId") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Analysis" ADD CONSTRAINT "fk_analysis_project_id" FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE CASCADE ON UPDATE NO ACTION;
