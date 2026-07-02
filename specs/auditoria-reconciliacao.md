# Spec: Auditoria de Reconciliação Multi-Agente (Raio do Conflito)

## Objetivo
Verificar que a compatibilização de código entre múltiplas sessões/agentes do Claude **não desfez nem quebrou** requisitos já implementados das specs `desdobramento-comercial` e `importacao-empresas-contatos`. Durante a "bagunça" (vários agentes no mesmo código), houve eventos de reconciliação de alto risco: colisão e deduplicação no `roadmapService.ts`, merge de `schema.prisma` carregando campos de duas features ao mesmo tempo, fix de `rules-of-hooks` no `PlatformAdmin`, dupla modificação de `client.ts`, um PR de formatação que tocou **459 arquivos**, e divergência entre `feat/growth-roadmap-build` e `main`. Esta spec define, requisito a requisito, **o que re-verificar contra o `main` atual** para caçar regressões silenciosas. É uma reconciliação pontual — daqui em diante somente o Claude coda neste repositório.

## Usuários
- **Claude (sessão de `/review`)** que executa a auditoria lendo código e rodando build/test/lint contra o `main`.
- **Kleber (dono)** que valida o relatório de gaps e decide as correções.

## Requisitos

### Obrigatórios

> Cada item é uma verificação ("o sistema deve **manter** X"). Um gap = X foi desfeito/quebrado pela reconciliação.

#### A. `roadmapService.ts` — a colisão mais séria
1. O `roadmapService.ts` em `main` deve conter `advanceToProposal` e `getPanel` **uma única vez cada** (a dedup removeu um bloco duplicado de 119 linhas vindo da colisão; confirmar que sobrou exatamente uma definição de cada, não zero, não duas).
2. A versão mantida de `advanceToProposal` deve ser a **integrada** (reusa `dealService`/Deal e a sincronização do Google), satisfazendo a spec comercial req 17 (criar/atualizar Deal em `PROPOSAL` com `companyId`+`empreendimentoId`; **reusar Deal aberto** existente em vez de duplicar; `status` do roadmap reflete a etapa).
3. `getPanel` deve continuar calculando o painel da spec comercial req 18 (próximas ações, atrasadas e **roadmaps em risco** sem ação há N dias, segmentável por vendedor).
4. `server/src/routes/roadmaps.ts` deve continuar chamando `advanceToProposal` e `getPanel`, e `server/src/__tests__/unit/roadmapService.test.ts` deve passar (vínculo roadmap→Deal e geração).

#### B. `schema.prisma` — merge de duas features
5. O `schema.prisma` em `main` deve conter **todos** os modelos da spec comercial (req 1-2): `Empreendimento`, `CommercialRoadmap`, `PlaybookTemplate`, `PlaybookStep`, `RoadmapStakeholder` e os enums `TaskType`, `CommercialRoadmapStatus`, `StakeholderRole`, `StakeholderPosture`.
6. Devem coexistir as extensões retrocompatíveis do comercial (req 3): `Lead.reportsToId`+`empreendimentoId`; `Task.type`+`companyId`+`empreendimentoId`+`roadmapId`; `Deal.empreendimentoId`; `DeepResearch.companyId`.
7. Devem coexistir, **sem terem sido perdidos no merge**, os campos da importação: `Company.externalId`+`cnpj`+`fantasyName`+`customFields`, índices `@@index([tenantId, externalId])`/`[tenantId, importBatchId]`, e o valor `COMPANIES` no enum `ImportType`.
8. As migrations de ambas as features devem existir e ser consistentes com o schema: `20260626000000_import_companies` e `20260627000000_desdobramento_comercial`; `prisma migrate status` / `db push` não acusam drift entre schema e migrations.

#### C. `PlatformAdmin` — `rules-of-hooks` + divergência de branch
9. `src/pages/PlatformAdmin.tsx` em `main` deve ter os hooks (`overviewQuery`, `tenantsQuery`, `createMutation`) **antes** do `if (!user?.isPlatformAdmin) return null` (satisfazendo `rules-of-hooks`) **e** com `enabled: !!user?.isPlatformAdmin` nas duas queries (preservando o comportamento original: não dispara requisições para não-admin).
10. A auditoria deve registrar que `feat/growth-roadmap-build` ainda tem a versão **antiga** desse arquivo (hooks após o `return`, sem `enabled`); o próximo merge `feat → main` **deve manter a versão do `main`**, não reintroduzir a violação nem as requisições para não-admin.

#### D. `client.ts` — dupla modificação (import + comercial)
11. `src/services/api/client.ts` em `main` deve conter **simultaneamente** os métodos da importação (`importCompaniesFile`, `importContactsFile`, tipo `ImportType` com `'COMPANIES'`, `ImportDuplicate.matchedBy` ampliado) **e** os do comercial (chamadas de roadmaps/empreendimentos/playbooks e `getPlatformOverview`/`getPlatformTenants`/`createPlatformTenant`) — nenhum dos dois conjuntos foi dropado no merge.

#### E. `importacao-empresas-contatos` — a formatação não pode ter mudado a lógica
12. O código de importação em `main` deve continuar satisfazendo a spec `importacao-empresas-contatos` após o Prettier (#37): suporte a `.xls` (`parseXlsBuffer`/`parseXls`), `analyzeCompanies`/`writeCompanies`, `contactsMode` em `analyzeLeads`/`writeLeads`, parsers BR (`parseBrNumber` tolerando ponto decimal do SheetJS; `parseBrDate`), `rollbackBatch` incluindo `Company`, rotas `/import/companies` e `/import/contacts`, e as abas **Empresas**/**Contatos** no frontend.
13. Os testes de importação (`importCompanies.test.ts`, `importWrite.test.ts`, `importDedup.test.ts`) devem passar em `main`.

#### F. Integridade geral em `main`
14. Em `main`: `cd server && npm run build` e `npx vitest run`, mais `npm run build`/`typecheck:ci` na raiz, devem passar; `npm run lint` deve sair com 0 erros e `format:check` limpo nos dois projetos; o CI do GitHub Actions deve estar **verde**.

### Fora do Escopo
- As **4 pendências conhecidas** do comercial (`desdobramento-comercial.pendencias.md`): `targetRole→leadId` (vacuamente satisfeito), `tenantId` direto em PlaybookStep/RoadmapStakeholder, editar título de Task existente, trocar `<select>` nativo por shadcn. São pendências **deliberadas**, não regressões — não contam como gap.
- Specs fora do raio do conflito: `import-pro`, `ai-sales-assistant`, `email-campaigns`, `api-hub`, `deep-research`, `visualizador-relatorio`, `growth-roadmap`. (Escolha do dono: foco no raio do conflito.)
- A **carga de dados em produção** da importação (220 empresas/357 contatos) — já verificada à parte (`verify-bd-legacy.ts`), não é alvo desta auditoria de código.
- Decisões operacionais: billing do GitHub Actions, repo público vs. privado.
- Reescrever/melhorar código além de **restaurar** o que a reconciliação desfez.

## Restrições
- A verificação roda **contra o `main`** (pós-PRs #36 e #37). A árvore atual `feat/growth-roadmap-build` está atrás e tem versões antigas dos arquivos reconciliados — fazer `git checkout main` (ou comparar `git diff feat...main`) antes de auditar; não auditar `feat` por engano.
- Verificação por **leitura de código + execução** (build/test/lint), não por inferência.
- O grosso do diff do #37 é **formatação Prettier (comportamento-neutro)**; a auditoria foca nos pontos de **lógica** reconciliados, não em reformatação.
- Não alterar comportamento ao corrigir um gap: restaurar o requisito original da spec correspondente, mínimo e rastreável.

## Casos Extremos
- **Dedup manteve a versão errada:** se `roadmapService` ficou com uma versão antiga/stub de `advanceToProposal` (sem reuso de Deal aberto) ou `getPanel` (sem cálculo de "em risco"), é gap em req A; rastrear contra a spec comercial req 17/18 e o caso extremo "Já existe Deal aberto".
- **Campo sumido no merge de schema (+463 linhas):** um campo de uma feature pode ter sido descartado ao reconciliar `schema.prisma`. Conferir contagem de modelos/enums/campos contra as duas specs (não confiar em "compila" — um campo nullable órfão compila).
- **`@ts-ignore`/`eslint-disable` essencial removido pela "limpeza":** confirmar que supressores necessários no CI seguem presentes — especialmente o `// @ts-ignore` do `import cookie` em `socketService.ts` (sem `@types/cookie` no CI), que já foi quebrado e restaurado uma vez.
- **Divergência `feat`↔`main`:** mapear o que cada lado tem que o outro não tem. `main` tem a formatação + os fixes reconciliados; `feat` pode ter trabalho não levado ao `main` ou versões antigas. Listar para a próxima reconciliação (especialmente `PlatformAdmin`, `roadmapService`, `schema.prisma`).
- **Migração aplicada fora de ordem:** as duas migrations (26/jun import, 27/jun comercial) têm timestamps próximos; confirmar que `migrate deploy`/`db push` não acusa inconsistência.
- **Função referenciada mas removida:** algum call-site (rota/hook/página) pode referenciar um método que a dedup removeu → erro de build. Cobrir com o build de F.

## Definição de Concluído
O `/review` desta spec produz um relatório de gaps. Está concluída quando:
- [ ] `roadmapService.ts` (main): `advanceToProposal` e `getPanel` presentes **uma vez**, na versão integrada; testes passam; rota os chama.
- [ ] `schema.prisma` (main): todos os modelos/enums/campos de **ambas** as specs presentes; migrations consistentes (`db push` sem drift).
- [ ] `PlatformAdmin.tsx` (main): hooks antes do redirect **+** `enabled` guard; divergência com `feat` documentada com a recomendação de manter a versão do `main` no próximo merge.
- [ ] `client.ts` (main): métodos de importação **e** de comercial presentes (nenhum conjunto perdido).
- [ ] Importação (main): requisitos da spec `importacao-empresas-contatos` intactos pós-formatação; 3 suites de teste de import passam.
- [ ] Build/test/lint/format/typecheck verdes em `main` e CI verde.
- [ ] Relatório lista **cada gap** com referência ao requisito original (`spec#req`) e a `arquivo:linha`; as 4 pendências conhecidas do comercial **não** são contadas como gap.
- [ ] Se 0 gaps: declarar explicitamente que a reconciliação preservou os requisitos das duas specs no raio do conflito.
