-- AlterTable
ALTER TABLE "RouteAssignment" ADD COLUMN     "supervisorId" TEXT;

-- CreateIndex
CREATE INDEX "RouteAssignment_supervisorId_idx" ON "RouteAssignment"("supervisorId");

-- AddForeignKey
ALTER TABLE "RouteAssignment" ADD CONSTRAINT "RouteAssignment_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
