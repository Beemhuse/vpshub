-- AlterTable
ALTER TABLE "Server" ADD COLUMN     "connectionStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "sshKey" TEXT,
ADD COLUMN     "sshPassword" TEXT,
ADD COLUMN     "sshPort" INTEGER NOT NULL DEFAULT 22,
ADD COLUMN     "sshUser" TEXT;
