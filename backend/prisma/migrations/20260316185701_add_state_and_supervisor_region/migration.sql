-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "state" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "state" TEXT;

-- CreateTable
CREATE TABLE "SupervisorRegion" (
    "id" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "state" TEXT NOT NULL,

    CONSTRAINT "SupervisorRegion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupervisorRegion_supervisorId_idx" ON "SupervisorRegion"("supervisorId");

-- CreateIndex
CREATE INDEX "SupervisorRegion_state_idx" ON "SupervisorRegion"("state");

-- CreateIndex
CREATE UNIQUE INDEX "SupervisorRegion_supervisorId_state_key" ON "SupervisorRegion"("supervisorId", "state");

-- CreateIndex
CREATE INDEX "Store_state_idx" ON "Store"("state");

-- CreateIndex
CREATE INDEX "User_state_idx" ON "User"("state");

-- AddForeignKey
ALTER TABLE "SupervisorRegion" ADD CONSTRAINT "SupervisorRegion_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
