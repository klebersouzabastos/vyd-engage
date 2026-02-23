-- Story 3.5: Database Enum Hardening
-- Converts String columns to proper PostgreSQL enums for type safety

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');
CREATE TYPE "PaymentMethod" AS ENUM ('CREDIT_CARD', 'PIX', 'BOLETO');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED');
CREATE TYPE "AutomationLogStatus" AS ENUM ('SUCCESS', 'ERROR', 'SKIPPED');
CREATE TYPE "InteractionType" AS ENUM ('EMAIL', 'WHATSAPP', 'CALL', 'MEETING', 'NOTE', 'STATUS_CHANGE', 'AUTOMATION');
CREATE TYPE "InteractionDirection" AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'SELECT', 'TEXTAREA', 'CHECKBOX');
CREATE TYPE "WebhookLogStatus" AS ENUM ('SUCCESS', 'FAILED', 'PENDING');

-- AlterTable: Subscription.billingCycle String → BillingCycle
ALTER TABLE "Subscription" ALTER COLUMN "billingCycle" DROP DEFAULT;
ALTER TABLE "Subscription" ALTER COLUMN "billingCycle" TYPE "BillingCycle" USING UPPER("billingCycle")::"BillingCycle";
ALTER TABLE "Subscription" ALTER COLUMN "billingCycle" SET DEFAULT 'MONTHLY'::"BillingCycle";

-- AlterTable: Payment.method String → PaymentMethod
ALTER TABLE "Payment" ALTER COLUMN "method" TYPE "PaymentMethod" USING UPPER("method")::"PaymentMethod";

-- AlterTable: Payment.status String → PaymentStatus
ALTER TABLE "Payment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Payment" ALTER COLUMN "status" TYPE "PaymentStatus" USING UPPER("status")::"PaymentStatus";
ALTER TABLE "Payment" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"PaymentStatus";

-- AlterTable: AutomationLog.status String → AutomationLogStatus
ALTER TABLE "AutomationLog" ALTER COLUMN "status" TYPE "AutomationLogStatus" USING UPPER("status")::"AutomationLogStatus";

-- AlterTable: Interaction.type String → InteractionType
ALTER TABLE "Interaction" ALTER COLUMN "type" TYPE "InteractionType" USING UPPER("type")::"InteractionType";

-- AlterTable: Interaction.direction String → InteractionDirection
ALTER TABLE "Interaction" ALTER COLUMN "direction" TYPE "InteractionDirection" USING UPPER("direction")::"InteractionDirection";

-- AlterTable: CustomField.type String → CustomFieldType
ALTER TABLE "CustomField" ALTER COLUMN "type" TYPE "CustomFieldType" USING UPPER("type")::"CustomFieldType";

-- AlterTable: WebhookLog.status String → WebhookLogStatus
ALTER TABLE "WebhookLog" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "WebhookLog" ALTER COLUMN "status" TYPE "WebhookLogStatus" USING UPPER("status")::"WebhookLogStatus";
ALTER TABLE "WebhookLog" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"WebhookLogStatus";
