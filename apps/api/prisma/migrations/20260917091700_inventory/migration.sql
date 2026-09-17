-- CreateTable
CREATE TABLE "locations" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "offeringId" UUID,
    "variantId" UUID,
    "stockableKey" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "offeringId" UUID,
    "variantId" UUID,
    "movementType" TEXT NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "reason" TEXT,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "locations_businessId_idx" ON "locations"("businessId");

-- CreateIndex
CREATE INDEX "inventory_items_businessId_locationId_idx" ON "inventory_items"("businessId", "locationId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_businessId_locationId_stockableKey_key" ON "inventory_items"("businessId", "locationId", "stockableKey");

-- CreateIndex
CREATE INDEX "inventory_movements_businessId_locationId_createdAt_idx" ON "inventory_movements"("businessId", "locationId", "createdAt");

-- CreateIndex
CREATE INDEX "inventory_movements_businessId_offeringId_idx" ON "inventory_movements"("businessId", "offeringId");

-- CreateIndex
CREATE INDEX "inventory_movements_businessId_variantId_idx" ON "inventory_movements"("businessId", "variantId");
