## [0.2.0] - 2026-03-18

### Security
- CORS restricted via CORS_ORIGINS env var
- Rate limiters applied before routes
- Email webhook secret validation
- Cross-tenant vulnerabilities fixed (dealService, scoringService, funnelService)
- Config encryption (AES-256-GCM) for WhatsApp/Email credentials
- Payment tokenization via Mercado Pago SDK

### Added
- Dark mode with system preference detection
- Mobile responsive layout (card views for leads/tasks)
- Onboarding tour for new users
- GitHub Actions CI pipeline
- Skeleton loading states
- Contextual empty states
- Design token system (55 CSS variables)
- Zod validation schemas
- Dynamic pricing on landing page

### Improved
- Leads.tsx decomposed into 4 focused components
- ~125 `any` types eliminated
- Server-side pagination for Leads
- AppProviders composition (App.tsx simplified)
- Bundle optimization (vendor chunks, dynamic ExcelJS import)
- Accessibility: ARIA labels, sr-only text, skip navigation
- Seed data fixed and enhanced

### Fixed
- FlowCRM branding references → VYD Engage
- Mock features marked as "Em breve"
- Dead state removed (advancedMode, selectedWidgetForConfig)
- localStorage business data migrated to API
