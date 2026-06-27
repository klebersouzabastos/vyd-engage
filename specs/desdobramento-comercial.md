# Spec: Desdobramento Comercial

## Objetivo
Transformar a inteligência de mercado em ações comerciais mapeadas e agendadas, para a área comercial não deixar passar oportunidades nem se perder na rota até o **pedido de proposta**. Na mesma rota `/app/deep-research`, além de "Pesquisa", o usuário ganha a opção **"Desdobramento Comercial"**: desdobra por **Empresa** ou **Empreendimento** (ambos sempre ligados à empresa e aos seus contatos), monta a **hierarquia de decisores**, escolhe um **playbook** (jornada de acessos) e o sistema gera uma **agenda de ações** (visitas, apresentações, ligações, reuniões) que alimenta o **funil de vendas** até a proposta. A solução reaproveita ao máximo a infraestrutura existente (Tarefas, Calendário, Google Calendar, lembretes, Company→Contato→Deal).

## Usuários
- **Equipe comercial** (vendedores/representantes da Tenax/K2+) que executa os acessos e segue a agenda gerada.
- **Gestor comercial / admin** que define playbooks, acompanha o pipeline e o painel "não deixar passar".
- Nível técnico variado; uso em desktop. Multi-tenant (cada empresa-cliente do SaaS isolada por `tenantId`).

## Requisitos

### Obrigatórios

#### A. Modelo de dados (fundação — Story 1)
1. O sistema deve adicionar os modelos Prisma `Empreendimento`, `CommercialRoadmap`, `PlaybookTemplate`, `PlaybookStep` e `RoadmapStakeholder`, todos escopados por `tenantId`, com índices por `tenantId` e pelas FKs principais.
2. O sistema deve adicionar os enums `TaskType` (VISITA, APRESENTACAO, LIGACAO, REUNIAO, EMAIL, PROPOSTA, OUTRO), `CommercialRoadmapStatus` (PLANEJAMENTO, EM_ANDAMENTO, PROPOSTA, GANHO, PERDIDO, ARQUIVADO), `StakeholderRole` (DECISOR, INFLUENCIADOR, TECNICO, APROVADOR, USUARIO) e `StakeholderPosture` (FAVORAVEL, NEUTRO, CONTRARIO, DESCONHECIDO).
3. O sistema deve estender, de forma retrocompatível (campos nullable + migração): `Lead` com `reportsToId` (FK self) e `empreendimentoId`; `Task` com `type`, `companyId`, `empreendimentoId` e `roadmapId`; `Deal` com `empreendimentoId`; `DeepResearch` com `companyId`.
4. Toda query nova deve filtrar por `tenantId`; exclusão de Company/Empreendimento referenciados deve usar `SetNull`/soft-delete (não apagar Tasks/roadmaps silenciosamente).

#### B. Empreendimento (Story 2)
5. O sistema deve expor CRUD de `Empreendimento` (`/api/v1/empreendimentos`), sempre vinculado a uma `Company` do mesmo tenant; criar sem `companyId` válido deve retornar 400.
6. A UI deve permitir cadastrar/listar empreendimentos de uma empresa e **vincular contatos** ao empreendimento (`Lead.empreendimentoId`).

#### C. Playbooks (Story 3)
7. O sistema deve expor CRUD de `PlaybookTemplate` + `PlaybookStep` (gerência restrita a admin); cada `PlaybookStep` define `order`, `title`, `actionType` (TaskType), `targetRole` (StakeholderRole, opcional), `offsetDays` e `priority`.
8. O sistema deve provisionar pelo menos 2 playbooks builtin por tenant (ex.: "Acesso a nova conta", "Empreendimento de obra").

#### D. Desdobramento / roadmap (Stories 4–5)
9. O sistema deve permitir criar um `CommercialRoadmap` escolhendo uma `Company` (obrigatória) e, opcionalmente, um `Empreendimento`, semeando opcionalmente de um `DeepResearch` (`deepResearchId`) e escolhendo um `PlaybookTemplate`.
10. Ao escolher um playbook na criação, o sistema deve gerar **uma `Task` por `PlaybookStep`** via `taskService.create()`, com `type` = `step.actionType`, `dueDate` = data de início + `offsetDays`, `priority`, `roadmapId`/`companyId`/`empreendimentoId` preenchidos e `leadId` = um stakeholder do `targetRole` quando existir.
11. A rota `/app/deep-research` deve ganhar um seletor **[Pesquisas] [Desdobramentos]**; a aba Desdobramentos lista os roadmaps e navega para o detalhe (rota irmã, ex.: `/app/deep-research/desdobramento/:id`).
12. O detalhe (RoadmapView) deve exibir: o organograma de decisores, a agenda/timeline das ações (Tasks filtradas por `roadmapId`), a barra de progresso até a proposta e o Deal vinculado.
13. O usuário deve poder **editar manualmente** o desdobramento: adicionar/editar/reagendar/atribuir ações (Tasks) e ajustar a hierarquia de contatos.

#### E. Agenda das ações (Story 5)
14. As ações geradas devem aparecer na **agenda/calendário existentes**, sincronizar com **Google Calendar** quando o usuário estiver conectado e disparar **lembretes** — reusando `taskService`, `googleCalendarService` e o job `taskNotificationChecker`, sem reimplementá-los.
15. O sistema deve oferecer a agenda do desdobramento (Tasks por `roadmapId`); as mesmas ações também devem aparecer na agenda global da equipe.

#### F. Organograma de decisores (Story 6)
16. O sistema deve permitir construir a hierarquia de contatos via `Lead.reportsToId` e registrar, por roadmap, o papel (`RoadmapStakeholder.roleInDecision`) e a postura (`posture`) de cada stakeholder; a UI deve exibir a hierarquia como árvore por empresa/empreendimento.

#### G. Integração com o pipeline (Story 7)
17. O `CommercialRoadmap` deve referenciar/alimentar um `Deal` (`dealId`); ao avançar para "pedido de proposta", o sistema deve criar/atualizar um `Deal` na etapa `PROPOSAL` (com `companyId` e `empreendimentoId`), e o `status` do roadmap deve refletir a etapa do Deal.

#### H. Painel "não deixar passar" (Story 8)
18. O sistema deve oferecer um painel com: próximas ações, ações atrasadas e **roadmaps em risco** (sem ação concluída/registrada há N dias), segmentável por vendedor.

### Fora do Escopo
- Geração por **IA** do desdobramento (decisão validada = playbook + manual; IA fica para evolução futura).
- Registro estruturado de visita técnica (SiteAccess), anexos/documentos/versionamento de proposta.
- App mobile dedicado a esta feature.
- Corrigir retroativamente a ausência de FK em `assignedTo` (dívida pré-existente, não bloqueia).

## Restrições
- Stack: Frontend React 18 + TS + Vite + shadcn; Backend Node + Express + Prisma + PostgreSQL. Sem stacks novas.
- Multi-tenant obrigatório (`tenantMiddleware`/`tenantScope`, `req.tenantId`); rotas autenticadas novas entram no whitelist de CSRF (`v1Router.use('/<rota>', csrfProtection)`).
- Seguir o padrão de feature do projeto: `service → route (+registro) → client → hook → page → types → menu`, espelhando `deepResearch*`.
- **Reúso obrigatório**: ações = `Task` (não criar sistema de agenda paralelo); usar `taskService.create()` como ponto de entrada (dispara Google sync + notificação + Socket.IO); playbooks inspirados em `StageTaskTemplate`.
- Frontend usa **Tailwind v4 pré-compilado** (sem JIT): componentes novos só usam classes já existentes em `src/index.css` ou trazem CSS próprio dedicado.
- Commits convencionais; **entrega incremental por story**, cada uma um PR atômico. Migrações são seguras (modelos novos; app ainda não em produção para eles).

## Casos Extremos
- **Empresa sem contatos:** o roadmap pode ser criado; as ações geradas ficam sem `leadId` (a atribuir) e o organograma fica vazio — sem erro.
- **Empreendimento sem `companyId` válido:** retorna 400 (empreendimento exige empresa).
- **Playbook sem steps (ou nenhum playbook escolhido):** o roadmap é criado sem ações geradas; o usuário adiciona manualmente.
- **Google Calendar não conectado:** as ações viram Tasks normalmente, sem evento no Google (fire-and-forget; não pode quebrar a criação).
- **Reagendar/cancelar uma ação:** deve sincronizar o evento do Google e os lembretes (reuso do fluxo de Task).
- **Já existe Deal aberto para a empresa/empreendimento:** ao chegar na proposta, reusar o Deal aberto correspondente em vez de criar duplicado; só criar novo se não houver.
- **Exclusão de Company/Empreendimento com roadmap ativo:** não apagar em cascata silenciosamente — `SetNull`/soft-delete e manter o roadmap/tasks acessíveis.
- **Concorrência:** dois usuários editando o mesmo roadmap não devem corromper a lista de ações (writes idempotentes/last-write-wins explícito).
- **Permissões:** gerência de playbooks restrita a admin; usuário comum vê/gerencia seus desdobramentos e ações dentro do tenant.

## Definição de Concluído
- [ ] Migrações Prisma aplicam sem erro; `cd server && npx vitest run && npm run build` e `npm run build` (raiz) passam limpos.
- [ ] É possível criar um **Empreendimento** ligado a uma Empresa e vincular contatos a ele.
- [ ] É possível gerenciar **Playbooks** (admin) e há builtins disponíveis por tenant.
- [ ] Criar um **Desdobramento** com um playbook gera **Tasks** que aparecem na agenda/calendário, sincronizam com o Google Calendar (quando conectado) e disparam lembretes.
- [ ] A rota `/app/deep-research` tem o seletor **Pesquisas/Desdobramentos**; a lista e o detalhe (organograma + agenda + progresso + Deal) funcionam.
- [ ] É possível montar o **organograma de decisores** (hierarquia + papel + postura) por empresa/empreendimento.
- [ ] Avançar o roadmap até **"pedido de proposta"** cria/atualiza um **Deal em PROPOSAL** vinculado à empresa/empreendimento.
- [ ] O **painel "não deixar passar"** lista próximas ações, atrasadas e roadmaps em risco por vendedor.
- [ ] Testes cobrem a geração de ações a partir do playbook e o vínculo roadmap→Deal.
- [ ] Cada story foi entregue como PR atômico (a spec é um épico, implementado incrementalmente).
