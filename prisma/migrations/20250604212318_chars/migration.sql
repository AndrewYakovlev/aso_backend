/*
  Warnings:

  - You are about to drop the column `categoryId` on the `Characteristic` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Characteristic" DROP CONSTRAINT "Characteristic_categoryId_fkey";

-- DropIndex
DROP INDEX "Characteristic_categoryId_idx";

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "metaDescription" TEXT,
ADD COLUMN     "metaKeywords" TEXT,
ADD COLUMN     "metaTitle" TEXT;

-- AlterTable
ALTER TABLE "Characteristic" DROP COLUMN "categoryId";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "metaDescription" TEXT,
ADD COLUMN     "metaKeywords" TEXT,
ADD COLUMN     "metaTitle" TEXT;

-- CreateTable
CREATE TABLE "CharacteristicCategory" (
    "id" TEXT NOT NULL,
    "characteristicId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "CharacteristicCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CharacteristicCategory_categoryId_idx" ON "CharacteristicCategory"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacteristicCategory_characteristicId_categoryId_key" ON "CharacteristicCategory"("characteristicId", "categoryId");

-- CreateIndex
CREATE INDEX "Characteristic_code_idx" ON "Characteristic"("code");

-- CreateIndex
CREATE INDEX "Characteristic_isFilterable_idx" ON "Characteristic"("isFilterable");

-- AddForeignKey
ALTER TABLE "CharacteristicCategory" ADD CONSTRAINT "CharacteristicCategory_characteristicId_fkey" FOREIGN KEY ("characteristicId") REFERENCES "Characteristic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacteristicCategory" ADD CONSTRAINT "CharacteristicCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
