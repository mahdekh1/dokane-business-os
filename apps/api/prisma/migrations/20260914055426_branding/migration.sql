-- CreateTable
CREATE TABLE "branding" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "primaryColor" TEXT NOT NULL DEFAULT '#0E6A57',
    "secondaryColor" TEXT NOT NULL DEFAULT '#D98E4B',
    "fontHeading" TEXT NOT NULL DEFAULT 'Fraunces',
    "fontBody" TEXT NOT NULL DEFAULT 'Hanken Grotesk',
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "branding_businessId_key" ON "branding"("businessId");
