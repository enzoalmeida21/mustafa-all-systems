-- AlterTable
ALTER TABLE "Store" ADD COLUMN "code" TEXT;
ALTER TABLE "Store" ALTER COLUMN "latitude" SET DEFAULT 0;
ALTER TABLE "Store" ALTER COLUMN "longitude" SET DEFAULT 0;

-- CreateIndex
CREATE INDEX "Store_code_idx" ON "Store"("code");

-- CreateIndex (unique, only for non-null values)
CREATE UNIQUE INDEX "Store_code_key" ON "Store"("code");
