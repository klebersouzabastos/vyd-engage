/**
 * Centralized OpenAPI path annotations (API-1.1, req 2/4).
 *
 * swagger-jsdoc scans `routes/*` for `@openapi` JSDoc blocks; this module holds
 * documented operations (with request/response EXAMPLES) for the primary route
 * groups. Every group is also declared as a tag in `config/openapi.ts`, so all
 * 28 groups appear in the spec; the priority groups below additionally show
 * concrete operations and examples.
 *
 * This file intentionally exports nothing at runtime — it exists for its JSDoc.
 */
export {};

/**
 * @openapi
 * components:
 *   schemas:
 *     Error:
 *       type: object
 *       properties:
 *         error: { type: string, example: "Validation error" }
 *         statusCode: { type: integer, example: 400 }
 *     Lead:
 *       type: object
 *       properties:
 *         id: { type: string, example: "lead_abc123" }
 *         name: { type: string, example: "Maria Silva" }
 *         email: { type: string, nullable: true, example: "maria@example.com" }
 *         phone: { type: string, nullable: true, example: "+5511999990000" }
 *         company: { type: string, nullable: true, example: "Acme Corp" }
 *         status: { type: string, example: "NEW" }
 *         source: { type: string, example: "WEBSITE" }
 *         score: { type: integer, example: 45 }
 *         createdAt: { type: string, format: date-time }
 *     Deal:
 *       type: object
 *       properties:
 *         id: { type: string, example: "deal_abc123" }
 *         name: { type: string, example: "Contrato Acme 2026" }
 *         value: { type: number, example: 85000 }
 *         stage: { type: string, example: "PROPOSAL" }
 *         probability: { type: integer, example: 40 }
 *     Task:
 *       type: object
 *       properties:
 *         id: { type: string, example: "task_abc123" }
 *         title: { type: string, example: "Follow up com Maria" }
 *         status: { type: string, example: "PENDING" }
 *         priority: { type: string, example: "HIGH" }
 *         dueDate: { type: string, format: date-time, nullable: true }
 */

// ===========================================================================
// Auth
// ===========================================================================
/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login com e-mail e senha
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *           example:
 *             email: "user@example.com"
 *             password: "s3nh4-forte"
 *     responses:
 *       200:
 *         description: Sessão criada (tokens em cookies httpOnly)
 *         content:
 *           application/json:
 *             example:
 *               status: 200
 *               data: { user: { id: "user_1", email: "user@example.com", role: "ADMIN" } }
 *       401:
 *         description: Credenciais inválidas
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */

// ===========================================================================
// Leads
// ===========================================================================
/**
 * @openapi
 * /leads:
 *   get:
 *     tags: [Leads]
 *     summary: Lista leads do tenant (paginado, filtrável)
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, example: "NEW" }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, example: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, example: 20 }
 *     responses:
 *       200:
 *         description: Página de leads
 *         content:
 *           application/json:
 *             example:
 *               data:
 *                 - id: "lead_abc123"
 *                   name: "Maria Silva"
 *                   email: "maria@example.com"
 *                   status: "NEW"
 *                   score: 45
 *               pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }
 *   post:
 *     tags: [Leads]
 *     summary: Cria um lead
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             name: "João Souza"
 *             email: "joao@example.com"
 *             phone: "+5511988887777"
 *             source: "WEBSITE"
 *     responses:
 *       201:
 *         description: Lead criado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Lead' }
 *       400:
 *         description: Erro de validação
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 * /leads/{id}:
 *   get:
 *     tags: [Leads]
 *     summary: Detalhe de um lead
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lead
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Lead' }
 *       404: { description: Lead não encontrado }
 *   put:
 *     tags: [Leads]
 *     summary: Atualiza um lead
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           example: { status: "CONTACTED", score: 60 }
 *     responses:
 *       200:
 *         description: Lead atualizado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Lead' }
 *   delete:
 *     tags: [Leads]
 *     summary: Remove um lead
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Removido }
 */

// ===========================================================================
// Deals
// ===========================================================================
/**
 * @openapi
 * /deals:
 *   get:
 *     tags: [Deals]
 *     summary: Lista deals do tenant
 *     responses:
 *       200:
 *         description: Lista de deals
 *         content:
 *           application/json:
 *             example:
 *               - id: "deal_abc123"
 *                 name: "Contrato Acme 2026"
 *                 value: 85000
 *                 stage: "PROPOSAL"
 *                 probability: 40
 *   post:
 *     tags: [Deals]
 *     summary: Cria um deal
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             name: "Contrato Acme 2026"
 *             value: 85000
 *             stage: "PROPOSAL"
 *             leadId: "lead_abc123"
 *     responses:
 *       201:
 *         description: Deal criado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Deal' }
 * /deals/{id}:
 *   put:
 *     tags: [Deals]
 *     summary: "Atualiza um deal (ex.: mover de estágio, marcar won/lost)"
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           example: { stage: "WON" }
 *     responses:
 *       200:
 *         description: Deal atualizado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Deal' }
 */

// ===========================================================================
// Tasks
// ===========================================================================
/**
 * @openapi
 * /tasks:
 *   get:
 *     tags: [Tasks]
 *     summary: Lista tarefas do tenant
 *     responses:
 *       200:
 *         description: Lista de tarefas
 *         content:
 *           application/json:
 *             example:
 *               data:
 *                 - id: "task_abc123"
 *                   title: "Follow up com Maria"
 *                   status: "PENDING"
 *                   priority: "HIGH"
 *   post:
 *     tags: [Tasks]
 *     summary: Cria uma tarefa
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             title: "Ligar para o cliente"
 *             priority: "HIGH"
 *             leadId: "lead_abc123"
 *             dueDate: "2026-07-01T12:00:00.000Z"
 *     responses:
 *       201:
 *         description: Tarefa criada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Task' }
 * /tasks/{id}:
 *   put:
 *     tags: [Tasks]
 *     summary: "Atualiza uma tarefa (ex.: marcar como concluída)"
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           example: { status: "COMPLETED" }
 *     responses:
 *       200:
 *         description: Tarefa atualizada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Task' }
 */

// ===========================================================================
// Companies
// ===========================================================================
/**
 * @openapi
 * /companies:
 *   get:
 *     tags: [Companies]
 *     summary: Lista empresas do tenant
 *     responses:
 *       200:
 *         description: Lista de empresas
 *         content:
 *           application/json:
 *             example:
 *               - id: "comp_1"
 *                 name: "Acme Corp"
 *                 domain: "acme.com"
 *                 industry: "Software"
 *   post:
 *     tags: [Companies]
 *     summary: Cria uma empresa
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example: { name: "Acme Corp", domain: "acme.com" }
 *     responses:
 *       201:
 *         description: Empresa criada
 *         content:
 *           application/json:
 *             example: { id: "comp_1", name: "Acme Corp", domain: "acme.com" }
 */

// ===========================================================================
// Tags
// ===========================================================================
/**
 * @openapi
 * /tags:
 *   get:
 *     tags: [Tags]
 *     summary: Lista tags do tenant
 *     responses:
 *       200:
 *         description: Lista de tags
 *         content:
 *           application/json:
 *             example:
 *               - id: "tag_1"
 *                 name: "inbound"
 *                 color: "#22c55e"
 *   post:
 *     tags: [Tags]
 *     summary: Cria uma tag
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example: { name: "inbound", color: "#22c55e" }
 *     responses:
 *       201:
 *         description: Tag criada
 *         content:
 *           application/json:
 *             example: { id: "tag_1", name: "inbound", color: "#22c55e" }
 */

// ===========================================================================
// Funnels
// ===========================================================================
/**
 * @openapi
 * /funnels:
 *   get:
 *     tags: [Funnels]
 *     summary: Lista funis (pipelines) e suas colunas
 *     responses:
 *       200:
 *         description: Lista de funis
 *         content:
 *           application/json:
 *             example:
 *               - id: "funnel_1"
 *                 name: "Pipeline Padrão"
 *                 columns:
 *                   - { id: "col_1", name: "Novo", order: 0 }
 *                   - { id: "col_2", name: "Qualificado", order: 1 }
 *   post:
 *     tags: [Funnels]
 *     summary: Cria um funil
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example: { name: "Pipeline Vendas" }
 *     responses:
 *       201:
 *         description: Funil criado
 *         content:
 *           application/json:
 *             example: { id: "funnel_1", name: "Pipeline Vendas" }
 */

// ===========================================================================
// Automations
// ===========================================================================
/**
 * @openapi
 * /automations:
 *   get:
 *     tags: [Automations]
 *     summary: Lista automações do tenant
 *     responses:
 *       200:
 *         description: Lista de automações
 *         content:
 *           application/json:
 *             example:
 *               - id: "auto_1"
 *                 name: "Welcome Email"
 *                 status: "ACTIVE"
 *                 trigger: { type: "lead_created" }
 *   post:
 *     tags: [Automations]
 *     summary: Cria uma automação
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             name: "Welcome Email"
 *             trigger: { type: "lead_created" }
 *             steps: []
 *     responses:
 *       201:
 *         description: Automação criada
 *         content:
 *           application/json:
 *             example: { id: "auto_1", name: "Welcome Email", status: "DRAFT" }
 */

// ===========================================================================
// API Keys
// ===========================================================================
/**
 * @openapi
 * /api-keys:
 *   get:
 *     tags: [API Keys]
 *     summary: Lista API keys do tenant (mascaradas) com seus scopes
 *     responses:
 *       200:
 *         description: Lista de API keys
 *         content:
 *           application/json:
 *             example:
 *               - id: "key_1"
 *                 name: "Zapier"
 *                 key: "fcrm_****a1b2c3d4"
 *                 scopes: ["leads:read"]
 *                 active: true
 *   post:
 *     tags: [API Keys]
 *     summary: Cria uma API key (retorna a chave completa uma única vez)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             name: "Zapier"
 *             scopes: ["leads:read", "leads:write"]
 *     responses:
 *       201:
 *         description: API key criada (key completa exibida só agora)
 *         content:
 *           application/json:
 *             example:
 *               id: "key_1"
 *               name: "Zapier"
 *               key: "fcrm_0123456789abcdef0123456789abcdef"
 *               scopes: ["leads:read", "leads:write"]
 *               active: true
 */

// ===========================================================================
// Outgoing Webhooks
// ===========================================================================
/**
 * @openapi
 * /outgoing-webhooks:
 *   get:
 *     tags: [Outgoing Webhooks]
 *     summary: Lista webhooks de saída do tenant
 *     responses:
 *       200:
 *         description: Lista de webhooks
 *         content:
 *           application/json:
 *             example:
 *               - id: "wh_1"
 *                 url: "https://hooks.zapier.com/abc"
 *                 events: ["lead.created", "deal.won"]
 *                 active: true
 *   post:
 *     tags: [Outgoing Webhooks]
 *     summary: Cria um webhook de saída (secret obrigatório; máx. 10 por tenant)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             url: "https://hooks.zapier.com/abc"
 *             events: ["lead.created", "deal.won"]
 *             secret: "meu-segredo-hmac"
 *     responses:
 *       201:
 *         description: Webhook criado
 *         content:
 *           application/json:
 *             example:
 *               id: "wh_1"
 *               url: "https://hooks.zapier.com/abc"
 *               events: ["lead.created", "deal.won"]
 *               active: true
 *       422:
 *         description: Limite de 10 webhooks por tenant atingido
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 * /outgoing-webhooks/{id}/logs:
 *   get:
 *     tags: [Outgoing Webhooks]
 *     summary: Últimos 100 disparos do webhook (status HTTP, duração, sucesso)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Logs de disparo
 *         content:
 *           application/json:
 *             example:
 *               - id: "log_1"
 *                 event: "deal.won"
 *                 statusCode: 200
 *                 durationMs: 142
 *                 success: true
 *                 createdAt: "2026-06-20T12:34:56.000Z"
 */

// ===========================================================================
// Webhooks (incoming)
// ===========================================================================
/**
 * @openapi
 * /webhooks/mercadopago:
 *   post:
 *     tags: [Webhooks]
 *     summary: Webhook de entrada do Mercado Pago (assinado, sem CSRF)
 *     security: []
 *     responses:
 *       200: { description: Recebido }
 *       401: { description: Assinatura inválida }
 */

// ===========================================================================
// Zapier
// ===========================================================================
/**
 * @openapi
 * /zapier/triggers/lead-created:
 *   get:
 *     tags: [Zapier]
 *     summary: Polling de leads recentes para o Zapier (auth via X-API-Key)
 *     security: [{ apiKey: [] }]
 *     parameters:
 *       - in: query
 *         name: since
 *         schema: { type: string, format: date-time }
 *         description: Retorna apenas leads criados a partir deste instante (ISO 8601)
 *       - in: query
 *         name: limit
 *         schema: { type: integer, example: 50 }
 *     responses:
 *       200:
 *         description: Lista de leads no formato achatado do Zapier
 *         content:
 *           application/json:
 *             example:
 *               - id: "lead_abc123"
 *                 name: "Maria Silva"
 *                 email: "maria@example.com"
 *                 status: "NEW"
 *                 score: 45
 *                 created_at: "2026-06-20T12:00:00.000Z"
 *       401: { description: API key ausente/inválida }
 *       403: { description: API key sem o scope leads:read }
 */

// ===========================================================================
// Remaining groups — primary operation each (req 4: every group present).
// ===========================================================================
/**
 * @openapi
 * /subscriptions:
 *   get:
 *     tags: [Subscriptions]
 *     summary: Assinatura atual do tenant
 *     responses:
 *       200:
 *         description: Assinatura
 *         content:
 *           application/json:
 *             example: { id: "sub_1", plan: "PRO", status: "ACTIVE" }
 * /payments:
 *   get:
 *     tags: [Payments]
 *     summary: Histórico de pagamentos do tenant
 *     responses:
 *       200:
 *         description: Lista de pagamentos
 *         content:
 *           application/json:
 *             example:
 *               - { id: "pay_1", amount: 199.9, status: "APPROVED" }
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: Lista usuários do tenant
 *     responses:
 *       200:
 *         description: Lista de usuários
 *         content:
 *           application/json:
 *             example:
 *               - { id: "user_1", email: "user@example.com", role: "ADMIN" }
 * /invitations:
 *   get:
 *     tags: [Invitations]
 *     summary: Lista convites pendentes
 *     responses:
 *       200:
 *         description: Lista de convites
 *         content:
 *           application/json:
 *             example:
 *               - { id: "inv_1", email: "novo@example.com", role: "USER", status: "PENDING" }
 * /custom-fields:
 *   get:
 *     tags: [Custom Fields]
 *     summary: Lista campos personalizados
 *     responses:
 *       200:
 *         description: Lista de campos
 *         content:
 *           application/json:
 *             example:
 *               - { id: "cf_1", name: "Orçamento", type: "NUMBER", entity: "LEAD" }
 * /interactions:
 *   get:
 *     tags: [Interactions]
 *     summary: Lista interações (filtrável por lead)
 *     parameters:
 *       - in: query
 *         name: leadId
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lista de interações
 *         content:
 *           application/json:
 *             example:
 *               - { id: "int_1", type: "NOTE", content: "Ligação realizada" }
 * /notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: Lista notificações do usuário
 *     responses:
 *       200:
 *         description: Lista de notificações
 *         content:
 *           application/json:
 *             example:
 *               - { id: "ntf_1", type: "TASK_DUE", read: false, title: "Tarefa vencendo" }
 * /scoring-rules:
 *   get:
 *     tags: [Scoring]
 *     summary: Lista regras de pontuação de leads
 *     responses:
 *       200:
 *         description: Lista de regras
 *         content:
 *           application/json:
 *             example:
 *               - { id: "rule_1", event: "EMAIL_OPENED", points: 5 }
 * /reports/sales:
 *   get:
 *     tags: [Reports]
 *     summary: Relatório de vendas (exemplo)
 *     responses:
 *       200:
 *         description: Métricas de vendas
 *         content:
 *           application/json:
 *             example: { wonCount: 12, wonValue: 540000, lostCount: 3 }
 * /saved-views:
 *   get:
 *     tags: [Saved Views]
 *     summary: Lista visualizações salvas
 *     responses:
 *       200:
 *         description: Lista de views
 *         content:
 *           application/json:
 *             example:
 *               - { id: "view_1", name: "Leads quentes", entity: "LEAD" }
 * /exports/leads:
 *   get:
 *     tags: [Exports]
 *     summary: "Exporta leads (ex.: CSV/XLSX)"
 *     responses:
 *       200: { description: Arquivo de exportação }
 * /integrations/calendar/status:
 *   get:
 *     tags: [Calendar]
 *     summary: Status da conexão de calendário (Google)
 *     responses:
 *       200:
 *         description: Status
 *         content:
 *           application/json:
 *             example: { connected: true, provider: "google" }
 * /email/configs:
 *   get:
 *     tags: [Email]
 *     summary: Lista configurações de e-mail do tenant
 *     responses:
 *       200:
 *         description: Lista de configs
 *         content:
 *           application/json:
 *             example:
 *               - { id: "ec_1", fromEmail: "vendas@example.com", provider: "resend" }
 * /whatsapp/connections:
 *   get:
 *     tags: [WhatsApp]
 *     summary: Lista conexões WhatsApp do tenant
 *     responses:
 *       200:
 *         description: Lista de conexões
 *         content:
 *           application/json:
 *             example:
 *               - { id: "wa_1", phoneNumber: "+5511999990000", status: "CONNECTED" }
 * /ai/status:
 *   get:
 *     tags: [AI]
 *     summary: Disponibilidade do assistente de IA (provider configurado?)
 *     responses:
 *       200:
 *         description: Status da IA
 *         content:
 *           application/json:
 *             example: { enabled: true, provider: "openai" }
 * /automation-logs:
 *   get:
 *     tags: [Automation Logs]
 *     summary: Lista logs de execução de automações
 *     responses:
 *       200:
 *         description: Lista de logs
 *         content:
 *           application/json:
 *             example:
 *               - { id: "alog_1", status: "SUCCESS", message: "Step 1 (send_email): enviado" }
 * /track/pixel/{token}:
 *   get:
 *     tags: [Tracking]
 *     summary: Pixel de rastreamento de abertura (público, sem auth)
 *     security: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: GIF transparente 1x1 }
 */
