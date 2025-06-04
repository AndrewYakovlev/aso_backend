/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `VehicleGeneration` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[slug]` on the table `VehicleMake` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[slug]` on the table `VehicleModel` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slug` to the `VehicleGeneration` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug` to the `VehicleMake` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug` to the `VehicleModel` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `VehicleModification` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "VehicleGeneration" ADD COLUMN     "slug" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "VehicleMake" ADD COLUMN     "slug" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "VehicleModel" ADD COLUMN     "slug" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "VehicleModification" ADD COLUMN     "name" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "VehicleGeneration_slug_key" ON "VehicleGeneration"("slug");

-- CreateIndex
CREATE INDEX "VehicleGeneration_slug_idx" ON "VehicleGeneration"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleMake_slug_key" ON "VehicleMake"("slug");

-- CreateIndex
CREATE INDEX "VehicleMake_slug_idx" ON "VehicleMake"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleModel_slug_key" ON "VehicleModel"("slug");

-- CreateIndex
CREATE INDEX "VehicleModel_slug_idx" ON "VehicleModel"("slug");

-- CreateIndex
CREATE INDEX "VehicleModification_name_idx" ON "VehicleModification"("name");
