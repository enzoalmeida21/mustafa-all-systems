-- CreateTable
CREATE TABLE "PromoterStoreRedoGrant" (
    "id" TEXT NOT NULL,
    "promoterId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "PromoterStoreRedoGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PromoterStoreRedoGrant_promoterId_storeId_idx" ON "PromoterStoreRedoGrant"("promoterId", "storeId");

-- CreateIndex
CREATE INDEX "PromoterStoreRedoGrant_usedAt_idx" ON "PromoterStoreRedoGrant"("usedAt");

-- AddForeignKey
ALTER TABLE "PromoterStoreRedoGrant" ADD CONSTRAINT "PromoterStoreRedoGrant_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoterStoreRedoGrant" ADD CONSTRAINT "PromoterStoreRedoGrant_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoterStoreRedoGrant" ADD CONSTRAINT "PromoterStoreRedoGrant_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
