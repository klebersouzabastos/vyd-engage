# Spec: Visualizador de Relatório — Inteligência de Mercado

## Objetivo
Redesenhar a visualização do relatório gerado pela "Inteligência de Mercado" para que o "site" apresentado seja moderno, bonito e com **identidade visual idêntica entre todos os relatórios**, oferecendo **navegação entre páginas**. O relatório deve poder ser lido de duas formas alternáveis — "Apresentação" (paginada, uma seção por vez) e "Leitura" (scroll contínuo) — com uma **capa de abertura** que carrega a identidade da empresa logada (tenant) e uma **barra de progresso**. O objetivo é dar à equipe comercial um material pronto para apresentar a clientes.

## Usuários
- **Equipe comercial / administradores da plataforma** (ex.: Tenax/K2+ Engenharia) que abrem um relatório concluído para ler ou apresentar a um cliente. Nível técnico variado; uso em desktop (apresentação) e eventualmente mobile.
- O conteúdo (relatório) é o mesmo para todos os usuários do tenant; o **prompt** continua restrito ao platform admin (aba separada, comportamento já existente — não muda).

## Requisitos

### Obrigatórios
1. O sistema deve renderizar o relatório (markdown já sanitizado) com **identidade visual consistente** entre todos os relatórios, controlada por uma folha de estilo dedicada do visualizador (não por utilitários Tailwind soltos — ver Restrições). A paleta deve seguir a identidade atual: azul primário `#2563eb`, cinzas, tabelas com cabeçalho escuro e zebra, títulos H2 com barra azul.
2. O sistema deve oferecer **dois modos de leitura alternáveis** por um toggle visível no topo do relatório: "Apresentação" (paginado) e "Leitura" (scroll contínuo). O modo escolhido deve ser **persistido em `localStorage`**; o padrão inicial é "Apresentação".
3. O sistema deve exibir uma **capa de abertura** com a **identidade do tenant** obtida via `useCompany()` (logo quando houver, senão um monograma; nome da empresa, ex.: "K2+ Engenharia"), um selo "Inteligência de Mercado" (e/ou o nome do modelo: Empresa/Segmento), o **título do relatório**, uma lista "O que este relatório aborda" derivada dos títulos das seções, a data, e — na variante de página inteira — um botão de ação "Começar". A capa tem duas variantes: `full` (página 0 no modo Apresentação) e `compact` (faixa no topo do modo Leitura).
4. No modo **Apresentação**, o sistema deve paginar o relatório por título de nível 2 (`## `), na ordem: capa → "Visão geral" (introdução, se houver) → uma página por seção → "Fontes" (se houver fontes). Deve haver botões **Anterior/Próximo** (desabilitados nas pontas), navegação por **setas do teclado** (←/→, ignoradas quando o foco está em campo de texto ou há tecla modificadora), e um **índice clicável** que pula direto para a página da seção. Ao trocar de página, o conteúdo rola para o topo.
5. No modo Apresentação, o sistema deve exibir uma **barra de progresso** e um rótulo de posição: "Seção X de Y" nas páginas de seção (X = ordinal entre as seções, Y = total de seções), "Capa" na capa, "Visão geral" na introdução e "Fontes" na página de fontes.
6. No modo **Leitura**, o sistema deve exibir a capa compacta no topo, o relatório inteiro renderizado em scroll contínuo, o bloco de Fontes ao final, um **índice lateral por âncoras com scroll-spy** (reaproveitando `ReportTOC` + `extractToc` + `useActiveHeading` existentes) e uma **barra fina de progresso de leitura** baseada na posição de rolagem.
7. O sistema deve exibir o **bloco de Fontes** (quando `searchResults` ou `sourceCount` existirem) de forma reutilizável nos dois modos: lista de fontes com título clicável (abre a URL em nova aba), data quando houver, e fallback para o nome do host quando não houver título.
8. No **mobile** (largura < 768px), o índice deve ficar acessível dentro de um `Drawer` (reaproveitando o padrão já existente em `DeepResearchView`) e o layout deve ser de coluna única; em **≥ 768px**, deve haver layout de duas colunas com o índice num trilho lateral fixo (sticky). Esse comportamento responsivo deve ser implementado via CSS (`@media`), não por utilitários `md:`.
9. O sistema deve integrar o novo visualizador substituindo o conteúdo da web page atual em `DeepResearchView.tsx` (o `reportBody`), preservando: cabeçalho, breadcrumb, botões, estados de carregando/vazio/falha (`StatusState`), o editor e a estrutura de abas do platform admin (Relatório/Prompt). Para o usuário comum (não admin), apenas o relatório é exibido (sem a aba Prompt).

### Fora do Escopo
- Exportar ou imprimir em PDF (e folha de estilo de impressão).
- Animações/transições de slide entre páginas.
- Deep-link do índice da página na URL (hash/route por seção).
- Filmstrip de miniaturas das seções.
- Divisão automática de uma seção muito longa em várias páginas.
- Corrigir retroativamente as classes `slate-*`/`md:*` "mortas" no restante do app (fora do visualizador).

## Restrições
- Stack: React 18 + TypeScript + Vite + shadcn/ui. **Sem novas dependências**, sem mudanças de rota e sem mudanças no backend.
- **Tailwind é pré-compilado e estático** (`src/index.css`, sem JIT): classes utilitárias novas no JSX **não geram CSS**. Verificado que NÃO existem no bundle: `text-slate-*`/`bg-slate-*`/`border-slate-*`, `sticky`, `leading-7`, `border-l-4`, `before:*`, nem `md:grid-cols-[260px_1fr]`/`md:gap-8`/`md:px-10`/`md:block`. Portanto, o visualizador deve **trazer sua própria folha de estilo** (`src/components/deepResearch/reportViewer.css`, importada pelo componente; o Vite empacota CSS importado), escopada sob `.report-viewer`. Classes comprovadamente compiladas podem ser usadas (`text-primary`, `bg-primary`, `bg-blue-50`, `flex`, `gap-*`, `rounded-*`, `w-full`) e os componentes shadcn `Button`/`Tabs`/`Progress` (classes já compiladas). Valores dinâmicos (largura/altura da barra de progresso) via `style` inline.
- Reutilizar o que já existe: `ReportRenderer` (renderização markdown→HTML, inalterado), `ReportTOC`/`extractToc`/`useActiveHeading` (índice por âncora do modo Leitura), `splitReportSections` (divisão por `## `, já criado), `useCompany()` (identidade do tenant).
- Identidade visual final igual entre relatórios: a estética sai do `reportViewer.css`, não da sorte de quais utilitários compilaram.

## Casos Extremos
- **Relatório sem nenhum H2** (`sections.length === 0`): forçar o modo "Leitura", esconder o toggle, e mostrar capa compacta + markdown inteiro (paginar um bloco único não faz sentido).
- **Introdução vazia**: não criar a página "Visão geral".
- **Sem fontes**: não criar a página/rodapé "Fontes".
- **Seção muito longa**: a página rola internamente e a navegação (Anterior/Próximo/progresso) permanece visível (rodapé sticky). Não dividir a seção automaticamente.
- **`pageIndex` fora dos limites**: sempre travar (clamp) entre 0 e última página; resetar para 0 quando o markdown do relatório mudar.
- **`localStorage` indisponível** (modo privado): proteger leitura/escrita com try/catch e cair no padrão "Apresentação".
- **Navegação por teclado**: as setas só agem quando o foco não está em `input`/`textarea` e não há tecla modificadora pressionada.
- **Conteúdo/markdown vazio**: o visualizador só é montado quando há relatório concluído (`hasReport`); os demais estados continuam tratados por `StatusState`.

## Definição de Concluído
- [ ] `npm run build` (raiz) passa sem erros de typecheck.
- [ ] `useReportPages` tem teste unitário cobrindo: capa-só quando não há seções; "Visão geral" só com intro não vazia; página de Fontes só quando há fontes; ordem correta das páginas.
- [ ] O toggle Apresentação/Leitura funciona e o modo escolhido persiste após recarregar a página.
- [ ] A capa exibe o nome (e o logo, quando houver) da empresa logada (ex.: "K2+ Engenharia"), o título do relatório e a lista "O que este relatório aborda".
- [ ] No modo Apresentação: Anterior/Próximo e setas do teclado navegam; o índice pula para a seção clicada; a barra de progresso e o rótulo "Seção X de Y" refletem a posição.
- [ ] No modo Leitura: o relatório rola por inteiro, o índice por âncora destaca a seção atual (scroll-spy) e a barra de progresso de leitura avança com a rolagem.
- [ ] O bloco de Fontes aparece nos dois modos com títulos clicáveis (abrindo em nova aba) e fallback de host.
- [ ] Em telas < 768px o índice abre num `Drawer` e o layout é de coluna única; em ≥ 768px há duas colunas com índice fixo.
- [ ] Relatório sem H2 cai no modo Leitura (sem toggle); relatório sem fontes não mostra a página/rodapé de Fontes; introdução vazia não gera "Visão geral".
- [ ] Dois relatórios diferentes apresentam a mesma identidade visual (mesma capa, tipografia, cores, tabelas e navegação).
- [ ] O platform admin continua vendo as abas Relatório/Prompt; usuários comuns veem apenas o relatório.
