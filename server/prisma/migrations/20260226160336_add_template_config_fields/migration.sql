/*
  Warnings:

  - You are about to drop the column `os` on the `Template` table. All the data in the column will be lost.
  - Added the required column `serverId` to the `Project` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "serverId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Template" DROP COLUMN "os",
ADD COLUMN     "buildCmd" TEXT,
ADD COLUMN     "defaultPort" INTEGER,
ADD COLUMN     "installCmd" TEXT,
ADD COLUMN     "outputDir" TEXT,
ADD COLUMN     "startCmd" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'STATIC',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
