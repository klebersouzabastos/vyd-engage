-- Playbook aprimoramento: função comercial responsável por passo + mapeamento a pessoas.
-- Aditivo e não-destrutivo (enum novo + 2 colunas opcionais); seguro para deploy em produção.

-- CreateEnum
CREATE TYPE "CommercialFunction" AS ENUM ('SDR', 'CLOSER', 'PRE_VENDAS', 'GESTOR', 'OUTRO');

-- AlterTable: função comercial do usuário (só pré-preenche o mapeamento; não altera acesso).
ALTER TABLE "User" ADD COLUMN "commercialFunction" "CommercialFunction";

-- AlterTable: função responsável por executar o passo do playbook.
ALTER TABLE "playbook_steps" ADD COLUMN "responsibleFunction" "CommercialFunction";
