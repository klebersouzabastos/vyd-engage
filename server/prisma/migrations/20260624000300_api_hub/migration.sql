-- API Hub epic: API key scopes + outgoing webhook log delivery metrics
-- NOTE: DO NOT apply automatically — review and run via `prisma migrate deploy`
-- against the correct environment. The .env in this repo points at PRODUCTION.

-- API-2.1 (req 17-21): granular permission scopes per API key.
-- Empty array = full access (backward compat for keys created before scopes).
ALTER TABLE "ApiKey" ADD COLUMN "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- API-1.2 (req 14): record delivery duration (ms) and success indicator per log.
ALTER TABLE "WebhookLog" ADD COLUMN "durationMs" INTEGER;
ALTER TABLE "WebhookLog" ADD COLUMN "success" BOOLEAN;
