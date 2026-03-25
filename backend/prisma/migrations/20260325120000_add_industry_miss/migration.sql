-- CreateEnum
CREATE TYPE "IndustryMissReason" AS ENUM ('STORE_CLOSED', 'NO_STOCK', 'NO_AUTHORIZATION', 'NO_MATERIAL', 'PROMOTER_ERROR', 'OTHER');

-- CreateTable
CREATE TABLE "IndustryMiss" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "promoterId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "industryId" TEXT NOT NULL,
    "reason" "IndustryMissReason" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndustryMiss_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IndustryMiss_visitId_industryId_key" ON "IndustryMiss"("visitId", "industryId");

-- CreateIndex
CREATE INDEX "IndustryMiss_promoterId_createdAt_idx" ON "IndustryMiss"("promoterId", "createdAt");

-- CreateIndex
CREATE INDEX "IndustryMiss_storeId_createdAt_idx" ON "IndustryMiss"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "IndustryMiss_industryId_createdAt_idx" ON "IndustryMiss"("industryId", "createdAt");

-- CreateIndex
CREATE INDEX "IndustryMiss_visitId_idx" ON "IndustryMiss"("visitId");

-- AddForeignKey
ALTER TABLE "IndustryMiss" ADD CONSTRAINT "IndustryMiss_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndustryMiss" ADD CONSTRAINT "IndustryMiss_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndustryMiss" ADD CONSTRAINT "IndustryMiss_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndustryMiss" ADD CONSTRAINT "IndustryMiss_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "Industry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

