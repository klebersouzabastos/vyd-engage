-- CreateEnum
CREATE TYPE "SuggestionType" AS ENUM ('IMPROVEMENT', 'BUG');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'IN_PROGRESS', 'DONE', 'REJECTED');

-- CreateTable
CREATE TABLE "Suggestion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "route" TEXT,
    "type" "SuggestionType" NOT NULL DEFAULT 'IMPROVEMENT',
    "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Suggestion_tenantId_idx" ON "Suggestion"("tenantId");

-- CreateIndex
CREATE INDEX "Suggestion_tenantId_status_idx" ON "Suggestion"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Suggestion_tenantId_userId_idx" ON "Suggestion"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "Suggestion_tenantId_createdAt_idx" ON "Suggestion"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
