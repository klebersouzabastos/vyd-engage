-- Upgrade RD parity — P3 (fecha o épico: WhatsApp no deal/empresa, extensão
-- Chrome, copiloto IA via WhatsApp, IA de reuniões).
-- Aditivo e não-destrutivo: 3 colunas novas + 1 FK. Nenhum tipo/enum alterado
-- (Attachment.source é TEXT — o novo valor "MEETING" não exige DDL). Seguro
-- para produção.

-- AlterTable: número do usuário p/ o copiloto reconhecer quem comanda (P3).
ALTER TABLE "User" ADD COLUMN "whatsappNumber" TEXT;

-- AlterTable: designa a conexão/número do copiloto IA (P3).
ALTER TABLE "WhatsAppConnection" ADD COLUMN "isCopilot" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: vínculo opcional do áudio da reunião à interação (P3).
ALTER TABLE "Interaction" ADD COLUMN "audioAttachmentId" TEXT;

-- AddForeignKey: áudio da reunião (Attachment source=MEETING) → SetNull para não
-- apagar a interação/transcrição se o anexo for removido.
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_audioAttachmentId_fkey" FOREIGN KEY ("audioAttachmentId") REFERENCES "attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
