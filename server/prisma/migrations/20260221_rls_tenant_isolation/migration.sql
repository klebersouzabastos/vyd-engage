-- Row Level Security (RLS) for tenant data isolation
-- This migration enables RLS on critical tables to ensure
-- users of Tenant A cannot access data from Tenant B via direct SQL.

-- Enable RLS on critical tables
ALTER TABLE "Lead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Interaction" ENABLE ROW LEVEL SECURITY;

-- Create policies for Lead table
CREATE POLICY "tenant_isolation_lead" ON "Lead"
  USING ("tenantId" = current_setting('app.current_tenant_id', true));

-- Create policies for User table
CREATE POLICY "tenant_isolation_user" ON "User"
  USING ("tenantId" = current_setting('app.current_tenant_id', true));

-- Create policies for Task table
CREATE POLICY "tenant_isolation_task" ON "Task"
  USING ("tenantId" = current_setting('app.current_tenant_id', true));

-- Create policies for Payment table
CREATE POLICY "tenant_isolation_payment" ON "Payment"
  USING ("tenantId" = current_setting('app.current_tenant_id', true));

-- Create policies for Interaction table
CREATE POLICY "tenant_isolation_interaction" ON "Interaction"
  USING ("tenantId" = current_setting('app.current_tenant_id', true));

-- NOTE: The application must SET LOCAL "app.current_tenant_id" = '<tenant-id>'
-- before executing queries when using a non-superuser database role.
-- Prisma's connection-level middleware should handle this.
-- The current application user (typically superuser in dev) bypasses RLS.
-- In production, use a restricted database role that respects RLS.
