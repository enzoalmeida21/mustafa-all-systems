-- CreateTable
CREATE TABLE "PromoterSupervisor" (
    "id" TEXT NOT NULL,
    "promoterId" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,

    CONSTRAINT "PromoterSupervisor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PromoterSupervisor_promoterId_idx" ON "PromoterSupervisor"("promoterId");

-- CreateIndex
CREATE INDEX "PromoterSupervisor_supervisorId_idx" ON "PromoterSupervisor"("supervisorId");

-- CreateIndex
CREATE UNIQUE INDEX "PromoterSupervisor_promoterId_supervisorId_key" ON "PromoterSupervisor"("promoterId", "supervisorId");

-- AddForeignKey
ALTER TABLE "PromoterSupervisor" ADD CONSTRAINT "PromoterSupervisor_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoterSupervisor" ADD CONSTRAINT "PromoterSupervisor_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
