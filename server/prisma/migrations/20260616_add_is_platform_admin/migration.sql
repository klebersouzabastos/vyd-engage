-- Super-admin da plataforma (cross-tenant). Coluna aditiva, segura para deploy.
ALTER TABLE "User" ADD COLUMN "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false;
