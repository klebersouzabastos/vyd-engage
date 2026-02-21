-- Rollback: Remove RLS policies and disable RLS

DROP POLICY IF EXISTS "tenant_isolation_lead" ON "Lead";
DROP POLICY IF EXISTS "tenant_isolation_user" ON "User";
DROP POLICY IF EXISTS "tenant_isolation_task" ON "Task";
DROP POLICY IF EXISTS "tenant_isolation_payment" ON "Payment";
DROP POLICY IF EXISTS "tenant_isolation_interaction" ON "Interaction";

ALTER TABLE "Lead" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "User" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Task" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Interaction" DISABLE ROW LEVEL SECURITY;
