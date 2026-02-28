-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "dockerImage" TEXT,
ADD COLUMN     "repositoryUrl" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'static';
