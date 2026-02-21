-- Row Level Security (RLS) Phase 2 — Secondary tables
-- Extends tenant isolation to all remaining tables with tenantId.

-- Enable RLS on secondary tables
ALTER TABLE "Tag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomField" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Automation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WhatsAppConnection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmailConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApiKey" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Webhook" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policies
CREATE POLICY "tenant_isolation_tag" ON "Tag"
  USING ("tenantId" = current_setting('app.current_tenant_id', true));

CREATE POLICY "tenant_isolation_custom_field" ON "CustomField"
  USING ("tenantId" = current_setting('app.current_tenant_id', true));

CREATE POLICY "tenant_isolation_automation" ON "Automation"
  USING ("tenantId" = current_setting('app.current_tenant_id', true));

CREATE POLICY "tenant_isolation_whatsapp" ON "WhatsAppConnection"
  USING ("tenantId" = current_setting('app.current_tenant_id', true));

CREATE POLICY "tenant_isolation_email_config" ON "EmailConfig"
  USING ("tenantId" = current_setting('app.current_tenant_id', true));

CREATE POLICY "tenant_isolation_api_key" ON "ApiKey"
  USING ("tenantId" = current_setting('app.current_tenant_id', true));

CREATE POLICY "tenant_isolation_webhook" ON "Webhook"
  USING ("tenantId" = current_setting('app.current_tenant_id', true));

CREATE POLICY "tenant_isolation_notification" ON "Notification"
  USING ("tenantId" = current_setting('app.current_tenant_id', true));

CREATE POLICY "tenant_isolation_invitation" ON "Invitation"
  USING ("tenantId" = current_setting('app.current_tenant_id', true));

CREATE POLICY "tenant_isolation_subscription" ON "Subscription"
  USING ("tenantId" = current_setting('app.current_tenant_id', true));
