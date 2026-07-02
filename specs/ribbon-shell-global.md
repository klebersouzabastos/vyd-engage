# Spec: Ribbon Shell Global (adoção do app-shell do vyd-design-system)

> **Amendment (01/07/2026): navegação nas ABAS, sem leftrail.** Após a entrega
> inicial (nav no `.vyd-leftrail`), o solicitante decidiu **remover o menu lateral**
> e mover **toda a navegação para as abas da ribbon** (`.vyd-ribbon-tabs`, padrão
> Autodesk). Isso **inverte os reqs 6, 7, 8 e 11**: a navegação principal (mesmos
> itens/ícones/ordem, filtro por papel, item ativo) agora vive nas abas; não há
> leftrail nem colapso nem drawer mobile (as abas rolam na horizontal); a faixa de
> abas passa a ser USADA (req 11 revisado). Todo o resto da spec (topbar, ribbon de
> comandos por tela, canvas, rightpanel, statusbar, públicas sem shell, âncoras)
> permanece válido. Componente: `src/components/shell/RibbonTabs.tsx`.

## Objetivo

Adotar o app-shell do `vyd-design-system` — o "ribbon Autodesk" definido em
`node_modules/vyd-design-system/css/shell.css` — como **chrome global de toda a
área autenticada `/app`** do VYD Engage, substituindo o layout Flexbox atual
(`AppLayout` + `Sidebar`) pelo grid CSS `.vyd-app`. Todas as telas passam a viver
dentro do mesmo shell invariante (topbar · ribbon · leftrail · canvas ·
rightpanel · statusbar); só o conteúdo do canvas e os comandos da ribbon mudam por
tela. O gatilho concreto foi o editor de automações, cuja paleta de botões lateral
(`NodePalette`, Gatilhos/Ações/Lógica) nunca foi migrada para a ribbon — este
trabalho corrige isso e generaliza o padrão para o app inteiro, de uma vez
("big-bang").

## Usuários

Usuários autenticados do VYD Engage (CRM SaaS multi-tenant): vendedores, gestores
e administradores comerciais, em desktop (uso primário) e telas menores. Nível
técnico variado; a navegação e os comandos precisam permanecer familiares — nomes,
ícones e ações existentes não mudam, apenas mudam de posição para dentro do shell.
O público-alvo desta spec para **construir e verificar** é um desenvolvedor
front-end (ou uma sessão futura de Claude).

## Requisitos

### Obrigatórios

#### A. Ativação do shell

1. O sistema deve importar `vyd-design-system/shell.css` **depois** de
   `vyd-design-system/theme.css` em `src/styles/globals.css` (hoje só `theme.css`
   é importado, em `globals.css:8`). O `shell.css` consome as variáveis
   `--vyd-layout-*` já definidas em `dist/variables.css` (topbar 44px, ribbon
   88px, ribbon-tabs 34px, ribbon-command 48px, leftrail 240px, leftrail-min 48px,
   rightpanel 300px, statusbar 26px) — nenhuma dessas variáveis deve ser
   redefinida pelo app.
2. O layout global de `/app` deve ser reescrito para usar o grid `.vyd-app` e as
   áreas do shell (`topbar`, `ribbontabs`, `ribbon`, `leftrail`, `canvas`,
   `rightpanel`, `statusbar`), substituindo o container Flexbox atual de
   `src/components/AppLayout.tsx`. O preset Tailwind já presente
   (`tailwind.config.js` → `presets: [require('vyd-design-system/tailwind')]`)
   deve ser preservado; classes utilitárias Tailwind podem coexistir com as
   classes `.vyd-*` do shell.

#### B. Topbar (`.vyd-topbar`)

3. A topbar deve ficar **sempre visível** (hoje o app só tem uma topbar mobile com
   hambúrguer, `AppLayout.tsx:48-58`) e conter, no mínimo: a marca "VYD Engage"
   (`.vyd-topbar__brand`), o nome do tenant/empresa atual, o gatilho do Command
   Palette (Cmd+K), o sino de notificações e o menu/avatar do usuário
   (`.vyd-avatar`).
4. O Command Palette existente (Cmd+K) deve continuar funcionando exatamente como
   hoje; a topbar apenas adiciona um gatilho clicável para ele. As notificações e o
   menu do usuário devem preservar seu comportamento atual (apenas mudam de lugar).
5. O nome da tela atual deve aparecer de forma legível no chrome (na topbar após a
   marca/tenant, ou como rótulo inicial da ribbon) para orientar o usuário.

#### C. Left rail / navegação (`.vyd-leftrail`)

6. A navegação principal hoje em `src/components/Sidebar.tsx` deve ser renderizada
   dentro de `.vyd-leftrail`, preservando: os mesmos itens de menu e ícones, a
   **filtragem por papel** (itens ADMIN/GESTOR só aparecem para esses papéis), o
   destaque do item ativo e a ordem atual.
7. O leftrail deve ser colapsável usando o modificador nativo do shell
   `.vyd-app--rail-collapsed` (240px → 48px), com um controle de colapsar/expandir.
   O estado de colapso deve persistir entre navegações (equivalente ao
   comportamento atual da Sidebar).
8. Em telas estreitas (≤ sm), o leftrail deve seguir o comportamento responsivo
   embutido no `shell.css` (o rail some) e a navegação deve permanecer acessível
   por um gatilho na topbar (overlay), preservando o acesso mobile que existe hoje.

#### D. Ribbon por tela (`.vyd-ribbon`)

9. Cada rota de `/app` deve renderizar uma `.vyd-ribbon` contextual com os comandos
   **daquela** tela, agrupados em `.vyd-ribbon-group` (cada grupo com
   `.vyd-ribbon-group__items` contendo `.vyd-ribbon-item` — ícone em `.glyph` +
   texto em `.label` — e um `.vyd-ribbon-group__label` de rótulo do grupo).
10. **Regra de conteúdo da ribbon (inegociável):** os comandos da ribbon de cada
    tela devem ser **derivados das ações que já existem** no header/toolbar/botões
    primários daquela tela. **Nenhum comando novo deve ser inventado.** Se uma tela
    não possui ações próprias, sua ribbon exibe apenas o rótulo/título da tela (sem
    grupos de comando).
11. As abas da ribbon (`.vyd-ribbon-tabs`) devem ficar **desativadas por padrão**
    (sem `.vyd-ribbon-tabs` no markup, a track colapsa para 0). Nenhuma tela desta
    entrega usa abas.
12. **Telas-âncora** (ribbon completa, servem de referência de implementação):
    - **Editor de Automações** (`AutomationBuilder`): a paleta lateral `NodePalette`
      deve ser **removida** e seus 3 grupos migrados para a ribbon como
      `.vyd-ribbon-group`: **Gatilhos** (itens desabilitados quando já existe um
      gatilho, preservando a regra `hasTrigger` atual), **Ações** e **Lógica**. As
      ações do topo do editor (nome da automação, switch Ativo, Salvar, Voltar)
      devem ser reposicionadas dentro do shell (ex.: grupo "Automação" na ribbon +
      navegação de volta), e o `FlowCanvas` deve ocupar o `.vyd-canvas`. Clicar num
      item da ribbon deve adicionar o nó correspondente exatamente como o
      `onAddNode` faz hoje.
    - **Dashboard** (`/app`): ribbon derivada dos filtros/ações já presentes na
      página (ex.: seletor de período, atalhos de widget existentes).
    - **Leads** (`/app/leads`): ribbon derivada das ações já presentes (ex.: Novo
      lead, importar, bulk actions, filtros/views salvas).
13. As demais rotas de `/app` (~27) devem receber a ribbon mínima gerada pela
    regra do requisito 10 (ações existentes migradas; sem grupos se não houver
    ação). A ausência de ribbon rica numa tela não-âncora **não** é um defeito.

#### E. Canvas, right panel e statusbar

14. O conteúdo de cada rota (hoje renderizado no `<main>` via `<Outlet/>`) deve ser
    renderizado dentro de `.vyd-canvas`, com rolagem própria e sem quebrar as
    páginas existentes.
15. O `SidePanel` existente (`SidePanelProvider`/`SidePanel`, hoje um painel modal
    lateral) deve ser hospedado em `.vyd-rightpanel` quando aberto. Quando não há
    painel aberto, a coluna do rightpanel deve colapsar para largura 0 (o canvas
    ocupa o espaço). O conteúdo e os gatilhos do SidePanel não mudam.
16. A statusbar (`.vyd-statusbar`) deve existir e conter, no mínimo: o nome do
    tenant/empresa atual, um indicador de online/offline e a versão do app.
    Conteúdo além disso está fora do escopo desta entrega.

#### F. Escopo de rotas e overlays

17. O shell deve envolver **apenas** as rotas autenticadas sob `/app`. As páginas
    públicas devem permanecer **sem** o shell: `/` (LandingPage), `/login`,
    `/register`, `/forgot-password`, `/reset-password`, `/onboarding`,
    `/capture/:formId`, `/s/:slug`, `/accept-invitation`.
18. Overlays globais existentes (`OnboardingTour`, `SuggestionFab`, `Toaster`/sonner)
    devem continuar funcionando sobre o shell, sem regressão.

### Fora do Escopo

- **Não** redesenhar componentes internos de página, tipografia ou cores — a
  migração de cores/tokens já foi tratada por `specs/design-system-migration.md`
  (esta spec é **puramente layout/shell**, sem sobreposição).
- **Não** inventar novos comandos, telas, filtros ou fluxos. A ribbon só reposiciona
  o que já existe.
- **Não** criar abas de ribbon, ferramentas novas na topbar (tool-switcher entre
  apps VYD) ou conteúdo extra na statusbar além do requisito 16.
- **Não** tocar backend, rotas de API, banco ou jobs.
- **Não** aplicar o shell às páginas públicas nem a e-mails/PDF/Excel exportados.
- **Não** portar o shell para outros apps do ecossistema VYD.

## Restrições

- **App em produção.** O VYD Engage já roda em produção (tenant `k2` ativo). Esta é
  uma mudança de chrome de altíssima visibilidade: deve ser construída em uma
  **branch dedicada**, verificada por completo, e implantada como **um único
  release** — nunca com o chrome parcialmente migrado no ar.
- **Branch paralela.** Existe uma branch `feat/design-system-migration` (migração de
  cores/tokens) com WIP não commitada tocando a camada visual. A ordem de merge deve
  ser coordenada para evitar conflito de chrome (idealmente esta spec parte da base
  já com a migração de tokens integrada, ou reconcilia explicitamente).
- **Tokens, não valores.** Todo dimensionamento de layout deve usar as variáveis
  `--vyd-layout-*` do design system; nada de alturas/larguras hardcoded que
  dupliquem o shell.
- **Sem regressão funcional.** Toda ação, atalho, permissão por papel e navegação
  existente deve continuar funcionando — só muda de posição.
- **Web-only.** Não há Capacitor/native neste projeto; foco em navegador.
- **Verificação sem produção.** A verificação visual deve ser feita em dev/preview
  local; não validar contra o banco de produção.

## Casos Extremos

- **Tela sem ações próprias:** a ribbon exibe só o título/rótulo da tela; não deve
  ficar visualmente "quebrada" nem colapsar o grid.
- **Papel sem itens de navegação** (ou com poucos): o leftrail deve renderizar
  apenas os itens permitidos, sem espaços vazios estranhos.
- **SidePanel aberto + tela estreita:** o rightpanel não pode espremer o canvas a
  ponto de inutilizá-lo; em ≤ sm o painel deve virar overlay em vez de coluna fixa.
- **Editor de Automações sem gatilho:** os itens do grupo "Gatilhos" da ribbon
  ficam habilitados; ao adicionar um gatilho, passam a desabilitados (regra
  `hasTrigger`), idêntico ao comportamento atual do `NodePalette`.
- **Muitos grupos de ribbon numa tela:** a ribbon deve rolar horizontalmente
  (`overflow-x: auto`, já previsto no `shell.css`) sem empurrar o canvas.
- **Rota profunda / recarregada** (ex.: `/app/automations/:id/builder` aberta
  direto): o shell deve montar normalmente, com leftrail e topbar presentes.
- **Colapso do leftrail:** alternar colapsar/expandir não pode remontar a página
  atual nem perder estado do canvas.

## Definição de Concluído

- [ ] `vyd-design-system/shell.css` importado após `theme.css` em `globals.css`.
- [ ] `AppLayout` reescrito sobre o grid `.vyd-app`; todas as ~30 rotas de `/app`
      renderizam dentro do shell (topbar + leftrail + ribbon + canvas + statusbar).
- [ ] Navegação da `Sidebar` migrada para `.vyd-leftrail` com filtragem por papel,
      item ativo, ordem e ícones preservados; colapso funciona e persiste.
- [ ] Topbar sempre visível com marca, tenant, gatilho Cmd+K, notificações e avatar;
      Command Palette, notificações e menu do usuário funcionam sem regressão.
- [ ] Editor de Automações **sem** paleta lateral: Gatilhos/Ações/Lógica na ribbon;
      adicionar nó, regra `hasTrigger`, nome/Ativo/Salvar/Voltar e `FlowCanvas`
      funcionando dentro do shell.
- [ ] Dashboard e Leads com ribbon derivada de suas ações existentes.
- [ ] Demais rotas com ribbon mínima (ações existentes migradas; sem comandos
      inventados; sem grupos quando não há ação).
- [ ] `SidePanel` hospedado no `.vyd-rightpanel` quando aberto e colapsado a 0
      quando fechado; overlays (`OnboardingTour`, `SuggestionFab`, `Toaster`) sem
      regressão.
- [ ] Statusbar com tenant + indicador online + versão.
- [ ] Páginas públicas continuam **sem** shell.
- [ ] Responsivo: em ≤ sm o leftrail some, a ribbon compacta e a navegação
      permanece acessível pela topbar.
- [ ] `npm run build` (frontend, typecheck + bundle) sem erros.
- [ ] Verificação visual em dev/preview das 3 telas-âncora + 2 rotas de lista
      quaisquer, confirmando chrome único e sem regressão de ações.
- [ ] Entregue em branch dedicada, para deploy como release único quando aprovado.
