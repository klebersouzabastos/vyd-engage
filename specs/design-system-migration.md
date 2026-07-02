# Spec: Migração da UI para o vyd-design-system (ordem exata de execução)

> Objetivo desta spec: definir a **ordem exata de execução** para que **100% da UI** do VYD Engage passe a respeitar o `vyd-design-system`, de forma incremental, verificável e sem quebrar o app entre passos, terminando com um **gate mecânico** que prova e protege os 100%. Baseada em inventário do código (workflow) + decisões do solicitante.

## Objetivo

Adotar o `vyd-design-system` (pacote publicado, versão `1.x`) como única fonte de verdade visual do frontend do VYD Engage: importar o `theme.css` uma vez, tornar os tokens semânticos (`var(--vyd-*)`, utilitários `bg-*`/`text-*`, classes `.vyd-*`) a base de toda a UI, **eliminar 100% das cores codificadas** (hex, `rgb/hsl` literais, classes arbitrárias `[#..]`, inline styles), fixar o **tema dark como padrão**, e impedir regressão com um gate automatizado. A migração é feita **camada por camada, de baixo para cima**, cada etapa com verificação própria.

## Usuários

- **Desenvolvedores frontend** — executam a migração fase a fase e mantêm o gate.
- **Revisor/arquiteto** — decide a estratégia de Tailwind (A vs B, ver Restrições) e valida cada gate.
- **Usuário final** — não deve perceber quebras durante a migração; ao final vê a UI padronizada no tema dark do DS.

## Contexto Técnico Crítico (fatos confirmados no código)

Estes fatos condicionam toda a ordem de execução:

1. **`src/index.css` é um artefato Tailwind v4.1.3 pré-compilado e commitado** (2.965 linhas; começa com `/*! tailwindcss v4.1.3 */`). **Nenhum script o gera** (não há passo de build que rode o Tailwind CLI).
2. **`src/main.tsx:3` importa `./index.css`** (o artefato), **não** `./styles/globals.css`.
3. **`src/styles/globals.css` é a fonte real de tokens** (`@import 'tailwindcss';` + `@theme { --color-primary: #2563eb; ... }` + blocos `:root`/`.dark`). **Hoje está desconectada do app** — editar o `@theme` não muda nada enquanto o entry importar o artefato.
4. **Não há `tailwind.config`, `postcss.config`, `.postcssrc` nem plugin `@tailwindcss/vite`.** Logo **não há JIT no build**: classes utilitárias novas no JSX (`bg-panel`, `text-action-primary`) **não geram CSS**.
5. **Superfície de cor codificada: ~448 ocorrências** em ~23 arquivos — ~124 hex em `.tsx/.ts`, ~299 hex + 8 `rgba` em CSS, 15 inline styles — mais superfícies especiais (Recharts, GrapesJS email, export PDF/Excel, PWA manifest, SVGs, Sonner).
6. **`next-themes` (v0.4.6)** está montado em `src/App.tsx:14` com `attribute="class" defaultTheme="system" enableSystem`.
7. **O pacote `vyd-design-system` está publicado** (instalável via `npm install vyd-design-system@1.x`) e fornece: `theme.css`, um preset Tailwind (`vyd-design-system/tailwind`), tokens `var(--vyd-*)`, utilitários `bg-*`/`text-*` e classes `.vyd-*`, com **tema dark padrão**.

## Requisitos

### Obrigatórios — Invariantes (valem em toda fase)

1. O app deve **compilar e funcionar** (`npm run build` verde; `npm run dev` sobe) ao final de **cada** fase — nenhuma fase pode deixar o app quebrado.
2. Nenhuma fase pode introduzir **cor codificada nova**; toda cor nova deve ser token do DS (`var(--vyd-*)` / classe do DS).
3. **`src/index.css` (artefato) nunca é editado à mão** — todo ajuste de token vai para `src/styles/globals.css` (`@theme`/`:root`/`.dark`); com a Opção A o artefato fica **obsoleto** (deixa de ser importado).
4. Ao final, **0 cor codificada** fora de uma allowlist justificada e o **gate mecânico** deve estar plugado em pre-commit **e** CI.
5. **Portabilidade — CSS vars primeiro:** a migração se apoia primariamente em `var(--vyd-*)` e classes `.vyd-*` (a **camada universal** do DS, que funciona em qualquer stack — React/Vue/vanilla, com ou sem Tailwind, qualquer versão). Os utilitários Tailwind (`bg-*`/`text-*`) são conveniência ergonômica **em cima** dessa base, não a fundação. Assim os mesmos tokens/padrões podem ser reusados por futuros projetos consumidores do DS mesmo que não usem Tailwind (ou usem outra versão).

### Obrigatórios — Ordem Exata de Execução

> Cada fase tem **Objetivo / Escopo / Passos / Gate de verificação**. Executar estritamente nesta ordem.

#### Fase 0 — Fundação: pacote + pipeline de CSS determinístico
- **Objetivo:** instalar o DS, importar o `theme.css` uma vez e tornar o pipeline determinístico **antes** de qualquer refactor de cor. Nada visual muda.
- **Escopo:** `package.json`, `src/main.tsx`, `src/styles/globals.css`, `vite.config.ts`.
- **Passos:**
  1. Fixar a versão: adicionar `"vyd-design-system": "1.x"` em `dependencies` e `npm install`.
  2. Importar o theme do DS **uma vez**: `@import 'vyd-design-system/theme.css';` no **topo** de `src/styles/globals.css` (antes de `@import 'tailwindcss'`), garantindo ordem de cascata (theme.css → tailwind → overrides → `.dark`).
  3. **Confirmar o contrato do pacote:** inspecionar o que o `vyd-design-system` instalado realmente exporta — `theme.css` (`var(--vyd-*)`), classes `.vyd-*`, e um **entry de preset compatível com Tailwind v4** (`@config`/`@plugin`, não apenas `require()` estilo v3). **Se o preset for v3-only**, usar o mecanismo v4 e tratar a camada `var(--vyd-*)`/`.vyd-*` como a base (a integração Tailwind vira opcional). Esse check destrava/valida o passo seguinte.
  4. **Aplicar a Opção A (decisão fixada — ver Restrições):** adicionar `@tailwindcss/vite` ao `vite.config.ts`, carregar o preset `vyd-design-system/tailwind` via `@config`/`@plugin` (v4), e **corrigir o entry**: `src/main.tsx` passa a importar `./styles/globals.css` em vez de `./index.css`; `src/index.css` sai do fluxo de import (adicionar ao `.gitignore` ou remover). Isso **destrava o JIT**.
  5. **Não** alterar nenhuma cor ainda.
- **Gate:** `npm run build` verde; DevTools mostra `:root { --vyd-* }` (theme.css carregou); **zero diferença visual** vs. antes; em Opção A, uma classe utilitária semântica de teste (`text-action-primary`) gera CSS.

#### Fase 1 — Tema dark como padrão
- **Objetivo:** dark vira o padrão (contrato do DS), com toggle funcional. Isolado para validar dark antes de migrar cores.
- **Escopo:** `src/App.tsx`, `src/components/ThemeToggle.tsx`, `index.html`, `vite.config.ts` (manifest).
- **Passos:**
  1. `src/App.tsx:14`: `defaultTheme="system"` → `defaultTheme="dark"` (manter `attribute="class"`; avaliar limpeza do valor persistido em `localStorage` de usuários com preferência antiga).
  2. Confirmar que o DS aplica dark via classe `.dark` no `<html>` (next-themes injeta); se o DS usa media-query, alinhar.
  3. Atualizar `theme-color`/`background_color` do manifest e a meta `theme-color` do `index.html` para valores dark (provisório; finalizado na Fase 6).
- **Gate:** app abre em dark; toggle alterna sem flash; `document.documentElement.classList` contém `dark` no load; telas principais legíveis; `npm run build` verde.

#### Fase 2 — Mapear tokens de tema do projeto → `var(--vyd-*)`
- **Objetivo:** reapontar os tokens semânticos do `@theme`/`globals.css` para os do DS, **sem tocar em componentes**. Como os primitivos shadcn já consomem `bg-primary`/`bg-card`/etc., remapear a fonte propaga para todo o app de uma vez.
- **Escopo:** `src/styles/globals.css` (`@theme`, `:root`, `.dark`); `src/utils/designTokens.ts`.
- **Passos:**
  1. No `@theme`/`:root`: trocar os valores hex dos tokens (`--color-primary`, `--background`, `--foreground`, `--card`, `--border`, `--input`, `--ring`, `--muted`, `--accent`, `--destructive`, `--secondary` + status/priority/stage/chart) por `var(--vyd-*)` conforme o **Mapa de Tokens**.
  2. Repetir no bloco `.dark { }`, apontando para os tokens dark do DS.
  3. `designTokens.ts`: garantir que `CHART_COLORS`/`SOURCE_COLORS`/`PRIORITY_CHART_COLORS`/`STAGE_ACCENT_COLORS` resolvam para `var(--vyd-*)` (reapontar os `--color-chart-*` no `@theme`).
- **Gate:** `npm run build` verde; no DevTools, botão/card/badge têm cor computada vinda de `var(--vyd-*)`; a paleta muda para a do DS consistentemente; **nenhum componente editado**.

#### Fase 3 — Primitivos shadcn (`src/components/ui/*`)
- **Objetivo:** garantir que os primitivos consumam só tokens semânticos (camada quase limpa hoje: 0 hex, 1 `hsl(var(--sidebar-border))`).
- **Escopo:** `src/components/ui/*.tsx`.
- **Passos:** auditar cada primitivo (só classes semânticas); normalizar `sidebar.tsx` (`--sidebar-border` mapeado); `sonner.tsx` (manter `theme` do next-themes + vars `--popover`/`--border` mapeadas); `chart.tsx` (`--color-${key}` derivam de tokens do DS).
- **Gate:** grep de hex em `src/components/ui/` = 0 (só refs `var()`); `npm run build` verde; botões/inputs/cards/badges/toasts com paleta DS em dark e light.

#### Fase 4 — Componentes compartilhados (não-ui)
- **Objetivo:** migrar componentes de nível médio muito reutilizados.
- **Escopo:** `DashboardWidget.tsx`, `ReportWidgetRenderer.tsx`, `ReportWidgetConfig.tsx`, `AppLayout.tsx`; `contexts/TagsContext.tsx`; `utils/tags.ts`, `utils/migration.ts`.
- **Passos:** default de cor de tag `#2563EB` (TagsContext:60, migration.ts) → token DS; paleta de 10 hex em `utils/tags.ts` → `designTokens`; placeholder de exemplo em `ReportWidgetConfig.tsx:315` → constante rotulada (allowlist); confirmar sidebar via tokens.
- **Gate:** grep de hex nesses arquivos = 0 (fora allowlist justificada); dashboard/reports com cores DS; `npm run build` verde; Vitest verde.

#### Fase 5 — Componentes de feature
- **Objetivo:** zerar ~34 hex em 9 componentes (mapas de estágio, stroke/fill de SVG/Recharts).
- **Escopo:** `forecast/FunnelChart.tsx`, `forecast/ForecastWidget.tsx`, `deals/DealAIScore.tsx`, `automations/FlowCanvas.tsx`, `automations/AutomationBuilder.tsx`, `settings/CompanyTab.tsx`, `settings/IntegrationsTab.tsx`.
- **Passos:** `FunnelChart` `STAGE_COLORS` (7 hex) → `STAGE_ACCENT_COLORS`; `ForecastWidget` `fill="#8B5CF6"` → `CHART_COLORS`; `DealAIScore` fallbacks hex e `stroke="#e5e7eb"` → tokens; edges de `FlowCanvas`/`AutomationBuilder` (`#22c55e`/`#ef4444`/`#e5e7eb`) → tokens success/error/border; `IntegrationsTab:19` scrollbarColor → var; **color-pickers reais** (`CompanyTab` cor de marca do tenant) permanecem como **dado do usuário** com default vindo de token e marca de allowlist.
- **Gate:** grep de hex em `components/{forecast,deals,automations,settings}` = 0 (fora allowlist de color-picker); render correto em dark; `npm run build` verde.

#### Fase 6 — Páginas
- **Objetivo:** zerar ~22 hex em 4 páginas (paletas Recharts).
- **Escopo:** `pages/WinLossReport.tsx`, `pages/Forecast.tsx`, `pages/Pipeline.tsx`, `pages/CampaignDetail.tsx`.
- **Passos:** `WinLossReport` `PIE_COLORS` (8) → `CHART_PALETTE`; `Forecast` 9 strokes/fills → `CHART_COLORS`/grid `var(--vyd-border)`; `Pipeline` `PIPELINE_COLUMN_COLORS` (6) → `CHART_PALETTE`; `CampaignDetail:242` `fill="#3B82F6"` → `CHART_COLORS.blue`; **finalizar** o `theme-color` do manifest/`index.html` com o valor dark final do DS (fecha a pendência da Fase 1).
- **Gate:** grep de hex em `src/pages` = 0; gráficos com paleta DS em dark; manifest reflete dark; `npm run build` verde.

#### Fase 7 — Superfícies especiais (fora do fluxo React)
- **Objetivo:** tratar markup/CSS gerado fora do React (não recebem tokens por cascata) — a parte que mais "esconde" hex.
- **Escopo:** `utils/reportExport.ts` (46 hex, PDF/Excel), `email/GrapesEmailBuilder.tsx` (7 hex), `components/deepResearch/reportViewer.css`, `components/comercial/organograma.css`, `public/*.svg`, `utils/webVitals.ts`.
- **Passos:** ver seção **Superfícies Especiais**. Em resumo: extrair `REPORT_PALETTE`/`EMAIL_PALETTE` de valores computados do DS (documentos self-contained não leem `var(--vyd-*)`) e **allowlist** desses arquivos; `reportViewer.css` reaponta `--rv-*` → `var(--vyd-*)`; `organograma.css` `#e2e8f0` → `var(--vyd-border)`; SVGs de `public/` e thresholds de `webVitals.ts` entram na allowlist.
- **Gate:** PDF/Excel/email-preview com a paleta correta; grep de hex fora da allowlist documentada = 0; `npm run build` verde.

#### Fase 8 — Gate mecânico + CI/pre-commit (prova de 100%)
- **Objetivo:** instituir o gate que garante 0 cor codificada e impede regressão. **Por último**, para passar de imediato.
- **Escopo:** `scripts/check-hardcoded-colors.mjs` (novo), `.stylelintrc.json` (novo), `package.json`, `.husky/pre-commit`, `.github/workflows/*`.
- **Passos:** ver seção **Gate Mecânico**. Criar o script grep (com allowlist central justificada), o Stylelint para CSS, os scripts npm, o hook husky e o job de CI; rodar uma vez e confirmar verde.
- **Gate:** `npm run check:colors` sai 0; `npm run lint:css` 0 erros; inserir um hex de teste faz **pre-commit e CI falharem** (prova de mordida); removê-lo volta a passar.

### Fora do Escopo

- Redesenhar componentes/layouts, mudar UX ou tipografia além de cor/tema — esta migração é de **design tokens/cores**, não de redesign.
- Migrar cor de **dados do usuário** (ex.: cor de marca do tenant em `CompanyTab`, cores salvas de tags/campanhas) — são dados, não tema; permanecem editáveis pelo usuário.
- Portar o `vyd-design-system` para outros apps do ecossistema (só o VYD Engage).
- Tornar e-mails/PDF/Excel/SVG estáticos "token-CSS-var" — impossível (documentos self-contained); tratados por paleta derivada + allowlist.
- Backend e qualquer coisa fora de `src/` do frontend.

## Restrições

- **Decisão: Opção A (fixada).** Reativar o pipeline Tailwind v4 real: `npm i -D @tailwindcss/vite`; adicionar `tailwindcss()` aos `plugins` do `vite.config.ts`; `main.tsx` importa `./styles/globals.css`; carregar o preset do DS via `@config`/`@plugin` (v4); descontinuar `src/index.css`. **Motivo:** o VYD Engage já é Tailwind v4 + shadcn e o estado pré-compilado (sem JIT) é um bug latente real (`max-w-*` bugado, utilities faltando — ver memória do projeto); A conserta isso de vez, habilita classes novas e honra 100% do contrato do pacote. O risco (mudar o pipeline) é contido pela Fase 0 isolada e verificável. **A escolha A é local do VYD Engage e não afeta como outros projetos consomem o DS** (portabilidade é decidida pela camada de CSS vars do pacote — ver invariante 5).
  - **Opção B (fallback documentado — para consumidores não-Tailwind ou Tailwind v3):** manter pré-compilado / não introduzir utilitários Tailwind novos; migrar só via `@import 'vyd-design-system/theme.css'` + `var(--vyd-*)` + classes `.vyd-*`. É exatamente a **camada universal** do DS — o caminho que qualquer projeto sem Tailwind (ou com outra versão) usa. Para o VYD Engage não é o preferido (mantém a fragilidade do artefato e o bug de `max-w-*`), mas permanece viável se a intenção for mexer o mínimo no pipeline.
- **Stack:** React 18 + Vite 6 + TypeScript + Tailwind v4 + shadcn/ui + next-themes; sem mudar libs além de adicionar o DS e (Opção A) `@tailwindcss/vite`/stylelint/husky.
- **Cascata:** `theme.css` do DS deve carregar **antes** dos overrides do projeto e do `.dark`; validar no DevTools.
- **Versão do DS pinada** em `1.x` no `package.json`.
- **Não editar `src/index.css`** manualmente (invariante 3).

## Mapa de Tokens (projeto → `var(--vyd-*)`)

| Cor/token do projeto | Intenção | Token do DS |
|---|---|---|
| `#2563eb` (`--color-primary`) | Ação primária / marca | `var(--vyd-action-primary)` |
| `--background` (branco) | Fundo base da página | `var(--vyd-bg-base)` |
| `--card` (branco) | Fundo de painel/cartão | `var(--vyd-bg-panel)` |
| `--foreground` | Texto principal | `var(--vyd-text-primary)` |
| `--muted-foreground` | Texto secundário | `var(--vyd-text-muted)` |
| `--border` / `--input` | Bordas / contorno de input | `var(--vyd-border)` |
| `--ring` | Anel de foco | `var(--vyd-focus-ring)` |
| `--secondary`/`--muted`/`--accent` | Superfície sutil/hover | `var(--vyd-bg-subtle)` |
| `--destructive` / `#dc2626` | Erro/destrutivo | `var(--vyd-status-danger)` |
| `#16a34a` | Sucesso / ganho | `var(--vyd-status-success)` |
| `#eab308`/`#ca8a04` | Aviso | `var(--vyd-status-warning)` |
| `#3b82f6` (`chart-blue`) | Série de gráfico 1 | `var(--vyd-chart-1)` |
| `#eab308` (`chart-yellow`) | Série 2 | `var(--vyd-chart-2)` |
| `#16a34a` (`chart-green`) | Série 3 | `var(--vyd-chart-3)` |
| `#f97316` (`chart-orange`) | Série 4 | `var(--vyd-chart-4)` |
| `#8b5cf6` (`chart-purple`) | Série 5 | `var(--vyd-chart-5)` |
| `#ec4899` (`chart-pink`) | Série 6 | `var(--vyd-chart-6)` |
| `#6366f1` (`chart-indigo`) | Série 7 | `var(--vyd-chart-7)` |
| `#6b7280` (`chart-gray`) | Neutro/estágio inicial | `var(--vyd-chart-neutral)` |
| `var(--popover)` (Sonner) | Fundo de toast/overlay | `var(--vyd-bg-overlay)` |
| `#2563eb`/`#ffffff` (PWA manifest) | Chrome do PWA | valor dark **computado** do token base (manifest não lê `var()`) |

> Os nomes exatos dos `--vyd-*` devem ser confirmados contra o `theme.css` real do pacote na Fase 0; a tabela fixa a **intenção semântica** de cada mapeamento.

## Gate Mecânico (0 cor codificada = 100%)

Duas verificações plugadas em **pre-commit** e **CI**:

1. **Script grep (JS/TS/inline)** — `scripts/check-hardcoded-colors.mjs` (Node, cross-platform):
   - Proíbe hex 3/4/6/8 (`#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b`) e `rgb(`/`rgba(`/`hsl(` com literais (excluindo `hsl(var(`/`rgb(var(`).
   - Escopo `src/**/*.{ts,tsx,css}` **exceto** `src/index.css` (artefato) e `node_modules`/`build`.
   - **Allowlist central justificada:** `utils/reportExport.ts`, `email/GrapesEmailBuilder.tsx`, `public/**/*.svg`, `utils/webVitals.ts`, e color-pickers reais (`CompanyTab.tsx` com comentário `// gate-allow: user color`). Cada entrada exige justificativa num array central.
   - Imprime `arquivo:linha` e `exit(1)` em match fora da allowlist.
2. **Stylelint (CSS)** — `.stylelintrc.json` estendendo `stylelint-config-standard` com `color-no-hex: true`, `color-named: "never"`, `function-no-unknown` ignorando `var`/`calc`/`color-mix`; roda em `src/**/*.css` exceto `src/index.css`.

**Plugagem:** `package.json` → `check:colors`, `lint:css`, e `lint` = `eslint + lint:css + check:colors`. `.husky/pre-commit` → `npm run check:colors && npm run lint:css`. CI → job `npm ci && npm run check:colors && npm run lint:css && npm run build`.

## Superfícies Especiais (tratamento específico)

- **Recharts** (FunnelChart, Forecast, WinLossReport, Pipeline, ForecastWidget, CampaignDetail, ChartContainer): `fill`/`stroke` não herdam Tailwind → canalizar 100% via `designTokens.ts` (`CHART_COLORS`/`CHART_PALETTE`/`STAGE_ACCENT_COLORS` → `var(--vyd-*)`); grid stroke `#E5E7EB` → `var(--vyd-border)`.
- **GrapesJS Email Builder:** e-mails HTML exigem cores **inline** (clientes de email não suportam `var()` confiável) → constante `EMAIL_PALETTE` derivada dos tokens de marca do DS; **allowlist** do arquivo.
- **Export PDF/Excel** (`reportExport.ts`): documentos self-contained não carregam `theme.css` → `REPORT_PALETTE` de valores print/dark do DS; Excel (`exceljs`) usa ARGB `FFxxxxxx` normalizado da mesma paleta; allowlist.
- **PWA manifest + `index.html` meta theme-color:** não leem `var()` → literal dark computado do token base (Fase 6); allowlist controlada.
- **Sonner/Toaster:** manter `theme` do next-themes + vars (`--normal-bg: var(--popover)`), garantindo mapeamento para `var(--vyd-*)`; sem literal.
- **SVGs** (`public/icon-*.svg`): estáticos → allowlist. SVGs inline com stroke fixo (`DealAIScore`, setas de `FunnelChart`) → `var(--vyd-*)` + `currentColor`.
- **CSS scoped** (`reportViewer.css` `--rv-*`, `organograma.css`): reapontar as definições de topo para `var(--vyd-*)`.

## Casos Extremos

- **`git ls-files src/index.css`** confirma artefato commitado sem gerador — a Opção A deve **descontinuar** o import dele; se por engano continuar importado, o app usa o CSS congelado e nenhuma mudança de token aparece.
- **Sem JIT (estado atual / Opção B):** classes utilitárias novas no JSX não geram CSS → usar `var(--vyd-*)`/`.vyd-*` ou adotar Opção A.
- **Ordem de cascata errada:** `theme.css` carregado depois do `.dark`/overrides quebra o dark → validar no DevTools.
- **`defaultTheme` migrado para `dark`** pode conflitar com valor `system`/`light` persistido em `localStorage` → definir estratégia (respeitar escolha do usuário vs. reset único).
- **Contraste em dark** em telas nunca testadas nesse tema (reports, email preview, gráficos) → QA visual por página.
- **Allowlist inflando sem justificativa** → esvazia o gate; exigir justificativa central por entrada e revisão.
- **`designTokens.ts` é gargalo:** erro de mapeamento propaga para todas as páginas de report → migrar com cuidado e QA visual.
- **Regeneração do artefato (Opção B):** dessincronização entre `globals.css` (fonte) e `index.css` (artefato) → sempre rebuildar após mudança de token.

## Definição de Concluído

- [ ] `vyd-design-system@1.x` instalado e pinado; `theme.css` importado **uma vez**; `:root { --vyd-* }` visível no DevTools.
- [ ] Opção A aplicada: contrato do pacote confirmado (entry Tailwind **v4-compatível**); `main.tsx` importa `styles/globals.css`; `@tailwindcss/vite` ativo; utilitários semânticos do DS geram CSS (JIT).
- [ ] `src/index.css` deixou de ser o entry (descontinuado/ignorado); nunca foi editado à mão.
- [ ] Tema **dark é o padrão**; toggle funciona; `.dark` no `<html>` no load; manifest/meta `theme-color` dark.
- [ ] Tokens de `globals.css` (`@theme`/`:root`/`.dark`) e `designTokens.ts` apontam para `var(--vyd-*)`; paleta do app é a do DS.
- [ ] `grep` de cor codificada retorna **0** em `src/components/ui`, `src/components/**` (feature/compartilhados), `src/pages` e `src/**/*.css` (exceto `index.css`), fora da allowlist justificada.
- [ ] Superfícies especiais (Recharts, email, PDF/Excel, manifest, Sonner, SVG, CSS scoped) tratadas conforme a seção; allowlist documentada com justificativa por entrada.
- [ ] `scripts/check-hardcoded-colors.mjs` e Stylelint criados; `npm run check:colors` e `npm run lint:css` saem **0**.
- [ ] Gate plugado em `.husky/pre-commit` **e** no CI; inserir um hex de teste **faz falhar** pre-commit e CI; removê-lo volta a passar (prova de mordida).
- [ ] `npm run build` e `npm run typecheck` verdes; Vitest verde; app funcional em todas as páginas no tema dark.
- [ ] Um desenvolvedor consegue, seguindo esta spec, executar as fases na ordem sem deixar o app quebrado entre elas, terminando com 100% da UI no `vyd-design-system` e protegido contra regressão.
