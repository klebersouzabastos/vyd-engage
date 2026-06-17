CREATE TABLE "MeetingAvailability" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 15,
    "availableHours" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingAvailability_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MeetingAvailability_slug_key" ON "MeetingAvailability"("slug");
CREATE INDEX "MeetingAvailability_tenantId_idx" ON "MeetingAvailability"("tenantId");
CREATE INDEX "MeetingAvailability_userId_idx" ON "MeetingAvailability"("userId");

ALTER TABLE "MeetingAvailability"
    ADD CONSTRAINT "MeetingAvailability_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MeetingAvailability"
    ADD CONSTRAINT "MeetingAvailability_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
