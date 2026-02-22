-- CreateTable: Funnel (Pipeline/Funnel per tenant)
CREATE TABLE "Funnel" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Funnel_pkey" PRIMARY KEY ("id")
);

-- CreateTable: FunnelColumn (Columns within a Funnel)
CREATE TABLE "FunnelColumn" (
    "id" TEXT NOT NULL,
    "funnelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "mappedStatus" "LeadStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FunnelColumn_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add pipeline position fields to Lead
ALTER TABLE "Lead" ADD COLUMN "funnelColumnId" TEXT;
ALTER TABLE "Lead" ADD COLUMN "positionInColumn" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex: Funnel indexes
CREATE UNIQUE INDEX "Funnel_tenantId_name_key" ON "Funnel"("tenantId", "name");
CREATE INDEX "Funnel_tenantId_idx" ON "Funnel"("tenantId");
CREATE INDEX "Funnel_tenantId_isDefault_idx" ON "Funnel"("tenantId", "isDefault");

-- CreateIndex: FunnelColumn indexes
CREATE INDEX "FunnelColumn_funnelId_idx" ON "FunnelColumn"("funnelId");
CREATE INDEX "FunnelColumn_funnelId_order_idx" ON "FunnelColumn"("funnelId", "order");

-- CreateIndex: Lead funnelColumnId index
CREATE INDEX "Lead_funnelColumnId_idx" ON "Lead"("funnelColumnId");

-- AddForeignKey: Funnel -> Tenant
ALTER TABLE "Funnel" ADD CONSTRAINT "Funnel_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: FunnelColumn -> Funnel
ALTER TABLE "FunnelColumn" ADD CONSTRAINT "FunnelColumn_funnelId_fkey" FOREIGN KEY ("funnelId") REFERENCES "Funnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Lead -> FunnelColumn
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_funnelColumnId_fkey" FOREIGN KEY ("funnelColumnId") REFERENCES "FunnelColumn"("id") ON DELETE SET NULL ON UPDATE CASCADE;
