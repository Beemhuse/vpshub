-- AlterTable
ALTER TABLE "Deployment" ADD COLUMN     "buildCmd" TEXT,
ADD COLUMN     "exposedPort" INTEGER,
ADD COLUMN     "installCmd" TEXT,
ADD COLUMN     "rootDir" TEXT,
ADD COLUMN     "startCmd" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "buildCmd" TEXT,
ADD COLUMN     "exposedPort" INTEGER,
ADD COLUMN     "installCmd" TEXT,
ADD COLUMN     "rootDir" TEXT,
ADD COLUMN     "startCmd" TEXT;
