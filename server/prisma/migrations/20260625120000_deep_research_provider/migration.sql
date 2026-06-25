-- Integração com a OpenAI Deep Research API (modo background): rastreio do
-- response id, erro e quando foi solicitado.

ALTER TABLE "deep_research" ADD COLUMN "providerResponseId" TEXT;
ALTER TABLE "deep_research" ADD COLUMN "providerError" TEXT;
ALTER TABLE "deep_research" ADD COLUMN "requestedAt" TIMESTAMP(3);

-- Índice para o poller localizar pesquisas em andamento com response pendente.
CREATE INDEX "deep_research_status_providerResponseId_idx" ON "deep_research"("status", "providerResponseId");
