-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "parentId" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offerings" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "categoryId" UUID,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sku" TEXT,
    "barcode" TEXT,
    "price" INTEGER NOT NULL,
    "cost" INTEGER,
    "trackInventory" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offerings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offering_variants" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "offeringId" UUID NOT NULL,
    "name" TEXT,
    "sku" TEXT,
    "barcode" TEXT,
    "price" INTEGER NOT NULL,
    "attributes" JSONB NOT NULL,
    "key" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offering_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offering_media" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "offeringId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "altText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offering_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "categories_businessId_idx" ON "categories"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_businessId_slug_key" ON "categories"("businessId", "slug");

-- CreateIndex
CREATE INDEX "offerings_businessId_active_idx" ON "offerings"("businessId", "active");

-- CreateIndex
CREATE INDEX "offerings_businessId_categoryId_idx" ON "offerings"("businessId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "offerings_businessId_sku_key" ON "offerings"("businessId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "offerings_businessId_barcode_key" ON "offerings"("businessId", "barcode");

-- CreateIndex
CREATE INDEX "offering_variants_offeringId_idx" ON "offering_variants"("offeringId");

-- CreateIndex
CREATE UNIQUE INDEX "offering_variants_offeringId_key_key" ON "offering_variants"("offeringId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "offering_variants_businessId_sku_key" ON "offering_variants"("businessId", "sku");

-- CreateIndex
CREATE INDEX "offering_media_offeringId_idx" ON "offering_media"("offeringId");

-- AddForeignKey
ALTER TABLE "offerings" ADD CONSTRAINT "offerings_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offering_variants" ADD CONSTRAINT "offering_variants_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offering_media" ADD CONSTRAINT "offering_media_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
