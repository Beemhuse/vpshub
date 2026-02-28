-- AlterTable
ALTER TABLE "Deployment" ADD COLUMN     "projectId" TEXT,
ADD COLUMN     "repositoryUrl" TEXT,
ADD COLUMN     "templateId" TEXT;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
