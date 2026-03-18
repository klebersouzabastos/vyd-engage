# Json Field Normalization Assessment

**Story:** EPIC-TD 4.6 (DB-10)
**Date:** 2026-03-18
**Status:** Assessment only — no schema changes

---

## Summary

The schema has 16 Json fields across 12 models. Each is assessed below with a recommendation.

## Assessment

### 1. Tenant.settings (line 116)
- **Content:** `{ timezone, language, currency }`
- **Structure:** Fixed, well-known keys
- **Recommendation:** NORMALIZE. These are 3 simple columns (timezone, language, currency) used in every tenant-scoped operation. Dedicated columns enable direct queries and indexing.
- **Priority:** Medium

### 2. Plan.features (line 192)
- **Content:** Array of strings (human-readable feature descriptions)
- **Structure:** Variable-length string array, display-only
- **Recommendation:** KEEP AS JSON. Display-only data, never queried or filtered. String array is a natural fit for Json.
- **Priority:** N/A

### 3. Plan.limits (line 193)
- **Content:** `{ maxLeads, maxUsers, maxAutomations, maxWhatsAppConnections, maxEmailConfigs, features: { ... } }`
- **Structure:** Fixed keys, numeric values + nested boolean map
- **Recommendation:** NORMALIZE (partial). Extract top-level numeric limits (maxLeads, maxUsers, etc.) into dedicated columns for plan-limit enforcement queries. Keep `features` sub-object as Json (boolean feature flags change infrequently).
- **Priority:** High — plan limits are checked on every lead/user creation.

### 4. Subscription.paymentMethod (line 218)
- **Content:** Payment method details (card last4, type, etc.)
- **Structure:** Varies by payment method type
- **Recommendation:** KEEP AS JSON. Polymorphic by nature (PIX vs credit card vs boleto have different shapes). Rarely queried directly.
- **Priority:** N/A

### 5. Payment.paymentData (line 251)
- **Content:** Encrypted payment transaction data from Mercado Pago
- **Structure:** External API response, variable
- **Recommendation:** KEEP AS JSON. Raw external API data, stored for audit/debugging. Never queried by field.
- **Priority:** N/A

### 6. ScoreRule.conditions (line 342)
- **Content:** Optional conditions for score rules (e.g., specific tag, status)
- **Structure:** Variable, depends on rule type
- **Recommendation:** KEEP AS JSON. Conditions are evaluated in application code, not SQL. Flexible schema allows new condition types without migration.
- **Priority:** N/A

### 7. Deal.customFields (line 381)
- **Content:** Tenant-defined custom field values `{ fieldName: value }`
- **Structure:** Dynamic, per-tenant schema
- **Recommendation:** KEEP AS JSON. Custom fields are inherently dynamic — each tenant defines their own. Normalizing would require EAV pattern which is worse.
- **Priority:** N/A

### 8. Lead.customFields (line 437)
- **Content:** Same as Deal.customFields
- **Recommendation:** KEEP AS JSON. Same reasoning as Deal.customFields.
- **Priority:** N/A

### 9. CustomField.options (line 501)
- **Content:** Array of options for SELECT-type custom fields
- **Structure:** Simple string array
- **Recommendation:** KEEP AS JSON. Small, bounded data. Only used when rendering select dropdowns.
- **Priority:** N/A

### 10. Automation.trigger (line 596)
- **Content:** Trigger configuration (event type, conditions, timing)
- **Structure:** Polymorphic — different trigger types have different shapes
- **Recommendation:** KEEP AS JSON. Automation triggers are config data evaluated by the automation engine. Schema varies by trigger type.
- **Priority:** N/A

### 11. Automation.steps (line 597)
- **Content:** Array of automation step definitions
- **Structure:** Ordered array of polymorphic step objects
- **Recommendation:** KEEP AS JSON. Steps are a workflow DSL — normalizing into rows would add complexity without query benefit. Steps are always loaded/saved as a unit.
- **Priority:** N/A

### 12. Automation.conditions (line 598)
- **Content:** Optional global conditions for the automation
- **Recommendation:** KEEP AS JSON. Same reasoning as trigger.
- **Priority:** N/A

### 13. AutomationLog.data (line 625)
- **Content:** Execution context data (previously held leadId, stepOrder, etc.)
- **Structure:** Partially normalized already (leadId, stepOrder, stepType, executionId extracted)
- **Recommendation:** KEEP AS JSON. Remaining data is debug/audit context. Core queryable fields already extracted.
- **Priority:** N/A (already addressed)

### 14. WhatsAppConnection.config (line 703)
- **Content:** Provider-specific connection config (encrypted)
- **Structure:** Varies by WhatsAppProvider enum
- **Recommendation:** KEEP AS JSON. Polymorphic by provider, encrypted at rest. Different providers need different config shapes.
- **Priority:** N/A

### 15. EmailConfig.config (line 741)
- **Content:** Provider-specific email config (encrypted)
- **Recommendation:** KEEP AS JSON. Same reasoning as WhatsAppConnection.config.
- **Priority:** N/A

### 16. Interaction.metadata (line 768)
- **Content:** Extra context per interaction (email headers, WhatsApp message IDs, etc.)
- **Recommendation:** KEEP AS JSON. Supplementary data that varies by InteractionType. Never filtered directly.
- **Priority:** N/A

### 17. Notification.metadata (line 886)
- **Content:** Extra notification context (related entity IDs, action URLs)
- **Recommendation:** KEEP AS JSON. Display/routing data, variable by NotificationType.
- **Priority:** N/A

### 18. Report.config (line 918)
- **Content:** `{ widgets, schedule, filters, shareSettings }`
- **Structure:** Complex nested config for report builder
- **Recommendation:** KEEP AS JSON. Report configs are loaded/saved as a unit. Normalizing would require multiple join tables for minimal benefit.
- **Priority:** N/A

---

## Action Items (Ordered by Priority)

| Priority | Field | Action | Effort |
|----------|-------|--------|--------|
| High | Plan.limits | Extract maxLeads, maxUsers, maxAutomations, maxWhatsAppConnections, maxEmailConfigs as columns | Small migration |
| Medium | Tenant.settings | Extract timezone, language, currency as columns | Small migration |
| None | All others (14 fields) | Keep as Json — appropriate use of flexible schema | N/A |

**Result:** 14 of 16 Json fields are appropriate. 2 fields would benefit from partial normalization, with Plan.limits being the highest priority due to its role in limit enforcement queries.
