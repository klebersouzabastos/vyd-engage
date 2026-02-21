-- Rollback: RLS Phase 2 — Secondary tables

DROP POLICY IF EXISTS "tenant_isolation_tag" ON "Tag";
DROP POLICY IF EXISTS "tenant_isolation_custom_field" ON "CustomField";
DROP POLICY IF EXISTS "tenant_isolation_automation" ON "Automation";
DROP POLICY IF EXISTS "tenant_isolation_whatsapp" ON "WhatsAppConnection";
DROP POLICY IF EXISTS "tenant_isolation_email_config" ON "EmailConfig";
DROP POLICY IF EXISTS "tenant_isolation_api_key" ON "ApiKey";
DROP POLICY IF EXISTS "tenant_isolation_webhook" ON "Webhook";
DROP POLICY IF EXISTS "tenant_isolation_notification" ON "Notification";
DROP POLICY IF EXISTS "tenant_isolation_invitation" ON "Invitation";
DROP POLICY IF EXISTS "tenant_isolation_subscription" ON "Subscription";

ALTER TABLE "Tag" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomField" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Automation" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "WhatsAppConnection" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "EmailConfig" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "ApiKey" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Webhook" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Invitation" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Subscription" DISABLE ROW LEVEL SECURITY;
