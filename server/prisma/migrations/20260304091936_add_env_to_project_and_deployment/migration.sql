-- AlterTable
ALTER TABLE "Deployment" ADD COLUMN     "env" JSONB;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "env" JSONB;
