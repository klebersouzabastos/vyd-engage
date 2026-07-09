-- Gestão de Atestados Técnicos: acervo, concorrências (RAG/pgvector), pendências, currículos.
-- Migração ADITIVA. Habilita pgvector para a busca semântica (AtestadoChunk.embedding).
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "AtestadoOrigem" AS ENUM ('PROPRIO', 'TERCEIRO');

-- CreateEnum
CREATE TYPE "AcervoTipo" AS ENUM ('OPERACIONAL', 'PROFISSIONAL', 'AMBOS');

-- CreateEnum
CREATE TYPE "VinculoProfissional" AS ENUM ('SOCIO', 'CLT', 'CONTRATO', 'DESLIGADO');

-- CreateEnum
CREATE TYPE "NaturezaParceria" AS ENUM ('CONSORCIO', 'SUBCONTRATACAO', 'CESSAO_DE_ACERVO');

-- CreateEnum
CREATE TYPE "AtestadoDocStatus" AS ENUM ('SEM_DOCUMENTO', 'PENDENTE_EXTRACAO', 'OK', 'ILEGIVEL');

-- CreateEnum
CREATE TYPE "ConcorrenciaStatus" AS ENUM ('RASCUNHO', 'ANALISANDO', 'CONCLUIDA', 'ARQUIVADA');

-- CreateEnum
CREATE TYPE "ExigenciaAcervo" AS ENUM ('OPERACIONAL', 'PROFISSIONAL', 'INDEFINIDO');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('ATENDE', 'ATENDE_PARCIAL', 'NAO_ATENDE', 'REVISAR');

-- CreateEnum
CREATE TYPE "PendenciaOrigem" AS ENUM ('DEAL', 'CONTRATO', 'MANUAL');

-- CreateEnum
CREATE TYPE "TaxonomiaTipo" AS ENUM ('CATEGORIA', 'DISCIPLINA', 'SEGMENTO', 'SERVICO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'ATESTADO_PENDENCIA_DUE';
ALTER TYPE "NotificationType" ADD VALUE 'ATESTADO_PENDENCIA_OVERDUE';
ALTER TYPE "NotificationType" ADD VALUE 'ATESTADO_ANALISE_CONCLUIDA';
ALTER TYPE "NotificationType" ADD VALUE 'ATESTADO_RT_DESLIGADO';

-- AlterEnum
ALTER TYPE "ImportType" ADD VALUE 'ATESTADOS';

-- CreateTable
CREATE TABLE "profissionais" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "nomeNorm" TEXT NOT NULL,
    "titulo" TEXT,
    "conselho" TEXT,
    "conselhoNum" TEXT,
    "conselhoUF" TEXT,
    "disciplinas" TEXT[],
    "segmento" TEXT,
    "area" TEXT,
    "vinculo" "VinculoProfissional" NOT NULL DEFAULT 'CONTRATO',
    "vinculoInicio" TIMESTAMP(3),
    "vinculoFim" TIMESTAMP(3),
    "email" TEXT,
    "telefone" TEXT,
    "curriculoResumo" TEXT,
    "importBatchId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profissionais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atestado_terceiros" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "empresa" TEXT NOT NULL,
    "contatoNome" TEXT,
    "contatoEmail" TEXT,
    "contatoTelefone" TEXT,
    "validadeParceria" TIMESTAMP(3),
    "condicoes" TEXT,
    "usoLivre" BOOLEAN NOT NULL DEFAULT false,
    "naturezaParceria" "NaturezaParceria",
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "atestado_terceiros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atestados" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "caixa" TEXT,
    "contratante" TEXT NOT NULL,
    "contrato" TEXT,
    "objeto" TEXT NOT NULL,
    "periodoTexto" TEXT,
    "dataInicio" TIMESTAMP(3),
    "dataConclusao" TIMESTAMP(3),
    "valorContrato" DECIMAL(14,2),
    "origem" "AtestadoOrigem" NOT NULL DEFAULT 'PROPRIO',
    "acervoTipo" "AcervoTipo" NOT NULL DEFAULT 'AMBOS',
    "artNumero" TEXT,
    "catNumero" TEXT,
    "conselho" TEXT,
    "conselhoUF" TEXT,
    "docStatus" "AtestadoDocStatus" NOT NULL DEFAULT 'SEM_DOCUMENTO',
    "textoExtraido" TEXT,
    "documentoAttachmentId" TEXT,
    "indexadoEm" TIMESTAMP(3),
    "terceiroId" TEXT,
    "importBatchId" TEXT,
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "atestados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atestado_responsaveis" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "atestadoId" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atestado_responsaveis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atestado_funcoes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "responsavelId" TEXT NOT NULL,
    "funcao" TEXT NOT NULL,
    "funcaoNorm" TEXT NOT NULL,
    "categoria" TEXT,
    "categoriaNorm" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atestado_funcoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atestado_quantitativos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "atestadoId" TEXT NOT NULL,
    "grandeza" TEXT NOT NULL,
    "valor" DECIMAL(18,4) NOT NULL,
    "unidade" TEXT NOT NULL,
    "descricao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atestado_quantitativos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atestado_chunks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "atestadoId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atestado_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concorrencias" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "orgao" TEXT,
    "editalTexto" TEXT,
    "editalAttachmentId" TEXT,
    "dossieAttachmentId" TEXT,
    "status" "ConcorrenciaStatus" NOT NULL DEFAULT 'RASCUNHO',
    "incluirTerceiros" BOOLEAN NOT NULL DEFAULT false,
    "promptUsed" TEXT NOT NULL DEFAULT '',
    "analiseErro" TEXT,
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "concorrencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concorrencia_exigencias" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "concorrenciaId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "descricao" TEXT NOT NULL,
    "acervo" "ExigenciaAcervo" NOT NULL DEFAULT 'INDEFINIDO',
    "grandeza" TEXT,
    "quantMinimo" DECIMAL(18,4),
    "unidade" TEXT,
    "permiteSomatorio" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "concorrencia_exigencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concorrencia_matches" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "exigenciaId" TEXT NOT NULL,
    "atestadoId" TEXT NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'REVISAR',
    "confianca" DOUBLE PRECISION,
    "quantComprovado" DECIMAL(18,4),
    "trecho" TEXT,
    "incluido" BOOLEAN NOT NULL DEFAULT true,
    "manual" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "concorrencia_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atestado_pendencia_status" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "builtin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atestado_pendencia_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atestado_pendencias" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "responsavelId" TEXT,
    "prazo" TIMESTAMP(3),
    "statusId" TEXT NOT NULL,
    "origem" "PendenciaOrigem" NOT NULL DEFAULT 'MANUAL',
    "dealId" TEXT,
    "companyId" TEXT,
    "osRef" TEXT,
    "atestadoId" TEXT,
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "atestado_pendencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atestado_curriculos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "segmento" TEXT,
    "area" TEXT,
    "disciplina" TEXT,
    "corpo" TEXT NOT NULL,
    "concorrenciaId" TEXT,
    "attachmentId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "atestado_curriculos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atestado_taxonomias" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" "TaxonomiaTipo" NOT NULL,
    "nome" TEXT NOT NULL,
    "nomeNorm" TEXT NOT NULL,
    "builtin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atestado_taxonomias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "profissionais_tenantId_idx" ON "profissionais"("tenantId");

-- CreateIndex
CREATE INDEX "profissionais_tenantId_importBatchId_idx" ON "profissionais"("tenantId", "importBatchId");

-- CreateIndex
CREATE INDEX "profissionais_tenantId_vinculo_idx" ON "profissionais"("tenantId", "vinculo");

-- CreateIndex
CREATE UNIQUE INDEX "profissionais_tenantId_nomeNorm_key" ON "profissionais"("tenantId", "nomeNorm");

-- CreateIndex
CREATE INDEX "atestado_terceiros_tenantId_idx" ON "atestado_terceiros"("tenantId");

-- CreateIndex
CREATE INDEX "atestados_tenantId_idx" ON "atestados"("tenantId");

-- CreateIndex
CREATE INDEX "atestados_tenantId_origem_idx" ON "atestados"("tenantId", "origem");

-- CreateIndex
CREATE INDEX "atestados_tenantId_importBatchId_idx" ON "atestados"("tenantId", "importBatchId");

-- CreateIndex
CREATE INDEX "atestados_tenantId_docStatus_idx" ON "atestados"("tenantId", "docStatus");

-- CreateIndex
CREATE UNIQUE INDEX "atestados_tenantId_origem_numero_key" ON "atestados"("tenantId", "origem", "numero");

-- CreateIndex
CREATE INDEX "atestado_responsaveis_tenantId_idx" ON "atestado_responsaveis"("tenantId");

-- CreateIndex
CREATE INDEX "atestado_responsaveis_profissionalId_idx" ON "atestado_responsaveis"("profissionalId");

-- CreateIndex
CREATE UNIQUE INDEX "atestado_responsaveis_atestadoId_profissionalId_key" ON "atestado_responsaveis"("atestadoId", "profissionalId");

-- CreateIndex
CREATE INDEX "atestado_funcoes_tenantId_idx" ON "atestado_funcoes"("tenantId");

-- CreateIndex
CREATE INDEX "atestado_funcoes_responsavelId_idx" ON "atestado_funcoes"("responsavelId");

-- CreateIndex
CREATE INDEX "atestado_quantitativos_tenantId_idx" ON "atestado_quantitativos"("tenantId");

-- CreateIndex
CREATE INDEX "atestado_quantitativos_atestadoId_idx" ON "atestado_quantitativos"("atestadoId");

-- CreateIndex
CREATE INDEX "atestado_chunks_tenantId_atestadoId_idx" ON "atestado_chunks"("tenantId", "atestadoId");

-- CreateIndex
CREATE INDEX "concorrencias_tenantId_idx" ON "concorrencias"("tenantId");

-- CreateIndex
CREATE INDEX "concorrencias_tenantId_status_idx" ON "concorrencias"("tenantId", "status");

-- CreateIndex
CREATE INDEX "concorrencia_exigencias_tenantId_idx" ON "concorrencia_exigencias"("tenantId");

-- CreateIndex
CREATE INDEX "concorrencia_exigencias_concorrenciaId_idx" ON "concorrencia_exigencias"("concorrenciaId");

-- CreateIndex
CREATE INDEX "concorrencia_matches_tenantId_idx" ON "concorrencia_matches"("tenantId");

-- CreateIndex
CREATE INDEX "concorrencia_matches_exigenciaId_idx" ON "concorrencia_matches"("exigenciaId");

-- CreateIndex
CREATE UNIQUE INDEX "concorrencia_matches_exigenciaId_atestadoId_key" ON "concorrencia_matches"("exigenciaId", "atestadoId");

-- CreateIndex
CREATE INDEX "atestado_pendencia_status_tenantId_idx" ON "atestado_pendencia_status"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "atestado_pendencia_status_tenantId_nome_key" ON "atestado_pendencia_status"("tenantId", "nome");

-- CreateIndex
CREATE INDEX "atestado_pendencias_tenantId_idx" ON "atestado_pendencias"("tenantId");

-- CreateIndex
CREATE INDEX "atestado_pendencias_tenantId_statusId_idx" ON "atestado_pendencias"("tenantId", "statusId");

-- CreateIndex
CREATE INDEX "atestado_pendencias_tenantId_prazo_idx" ON "atestado_pendencias"("tenantId", "prazo");

-- CreateIndex
CREATE INDEX "atestado_pendencias_tenantId_dealId_idx" ON "atestado_pendencias"("tenantId", "dealId");

-- CreateIndex
CREATE INDEX "atestado_curriculos_tenantId_idx" ON "atestado_curriculos"("tenantId");

-- CreateIndex
CREATE INDEX "atestado_curriculos_tenantId_profissionalId_idx" ON "atestado_curriculos"("tenantId", "profissionalId");

-- CreateIndex
CREATE INDEX "atestado_curriculos_tenantId_concorrenciaId_idx" ON "atestado_curriculos"("tenantId", "concorrenciaId");

-- CreateIndex
CREATE INDEX "atestado_taxonomias_tenantId_tipo_idx" ON "atestado_taxonomias"("tenantId", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "atestado_taxonomias_tenantId_tipo_nomeNorm_key" ON "atestado_taxonomias"("tenantId", "tipo", "nomeNorm");

-- AddForeignKey
ALTER TABLE "profissionais" ADD CONSTRAINT "profissionais_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atestado_terceiros" ADD CONSTRAINT "atestado_terceiros_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atestados" ADD CONSTRAINT "atestados_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atestados" ADD CONSTRAINT "atestados_terceiroId_fkey" FOREIGN KEY ("terceiroId") REFERENCES "atestado_terceiros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atestado_responsaveis" ADD CONSTRAINT "atestado_responsaveis_atestadoId_fkey" FOREIGN KEY ("atestadoId") REFERENCES "atestados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atestado_responsaveis" ADD CONSTRAINT "atestado_responsaveis_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "profissionais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atestado_funcoes" ADD CONSTRAINT "atestado_funcoes_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "atestado_responsaveis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atestado_quantitativos" ADD CONSTRAINT "atestado_quantitativos_atestadoId_fkey" FOREIGN KEY ("atestadoId") REFERENCES "atestados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atestado_chunks" ADD CONSTRAINT "atestado_chunks_atestadoId_fkey" FOREIGN KEY ("atestadoId") REFERENCES "atestados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concorrencias" ADD CONSTRAINT "concorrencias_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concorrencia_exigencias" ADD CONSTRAINT "concorrencia_exigencias_concorrenciaId_fkey" FOREIGN KEY ("concorrenciaId") REFERENCES "concorrencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concorrencia_matches" ADD CONSTRAINT "concorrencia_matches_exigenciaId_fkey" FOREIGN KEY ("exigenciaId") REFERENCES "concorrencia_exigencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concorrencia_matches" ADD CONSTRAINT "concorrencia_matches_atestadoId_fkey" FOREIGN KEY ("atestadoId") REFERENCES "atestados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atestado_pendencia_status" ADD CONSTRAINT "atestado_pendencia_status_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atestado_pendencias" ADD CONSTRAINT "atestado_pendencias_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atestado_pendencias" ADD CONSTRAINT "atestado_pendencias_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "atestado_pendencia_status"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atestado_curriculos" ADD CONSTRAINT "atestado_curriculos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atestado_curriculos" ADD CONSTRAINT "atestado_curriculos_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "profissionais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atestado_taxonomias" ADD CONSTRAINT "atestado_taxonomias_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Atestados: limiar configuravel de antecedencia do alerta de pendencias (req 33).
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "atestadoAlertDays" INTEGER NOT NULL DEFAULT 7;
