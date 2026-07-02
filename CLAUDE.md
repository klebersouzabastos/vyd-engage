# CLAUDE.md — VYD Engage

> Guia de arquitetura/comandos detalhado em [`.claude/CLAUDE.md`](.claude/CLAUDE.md).
> Este arquivo fixa as **regras de UI do ecossistema VYD** (obrigatórias em toda edição).

## Regras de UI VYD (obrigatórias)

Design system: **`vyd-design-system@2`** (+ **`vyd-react@2`** por ser React). Fonte de
verdade das regras: **`node_modules/vyd-design-system/AGENTS.md`** — siga-o sem exceção.
Importar `vyd-design-system/theme.css` (e `shell.css` para o app-shell) uma vez no entry
(`src/styles/globals.css`).

- **NAVEGAÇÃO = ribbon no topo** (abas de seção `.vyd-ribbon-tab` + comandos agrupados
  `.vyd-ribbon`). **NUNCA** criar menu/sidebar/nav/drawer na **lateral esquerda**.
- **Sem painéis laterais no shell.** Shell é **coluna única**: o canvas ocupa a largura
  toda. Estrutura: `.vyd-app > .vyd-topbar / .vyd-ribbon-tabs / .vyd-ribbon / .vyd-canvas
  / .vyd-statusbar`. Listas, inspetores e propriedades são **conteúdo DENTRO do canvas**
  (card, painel flutuante, aba) ou **overlay** (Sheet) — nunca coluna fixa do shell.
- **Cores:** só tokens semânticos (`bg-chrome/panel/canvas`, `text-primary/secondary`,
  `border-default`, `bg-action-primary` + `text-on-accent`). **Nunca** hex/rgb literal.
  (Gate: `npm run check:colors` + `lint:css`.)
- **Texto de leitura = `text-primary`**; `text-secondary` só p/ meta (rótulos/timestamps).
  Nunca cinzas próprios nem redução de opacidade.
- **Temas:** dark (padrão), light, high-contrast via `<html data-vyd-theme="…">`.
- **Densidade:** base 13px, `radius-md`, hierarquia por linha de 1px (não sombra).
  "Ativo" = barra de acento de 2px.
- **Componentes prontos:** `.vyd-btn`, `.vyd-input`, `.vyd-card`, `.vyd-table`,
  `.vyd-alert`, `.vyd-badge`… Em React, prefira `vyd-react` (`Button`, `Field`, `Dialog`,
  `Table`…). Em React o DS **não tem** `LeftRail`/`RailItem`/`RightPanel`.

### Estado atual neste app
- Shell próprio em `src/components/shell/` (`AppShell`, `RibbonTabs`, `Topbar`,
  `StatusBar`) consumindo o CSS do DS (não os componentes `vyd-react` ainda).
- Navegação de **dois níveis** (categorias → itens) em `RibbonTabs.tsx`; comandos por-tela
  no **corpo** das páginas; detalhes de Lead/Deal via **Sheet** overlay (`SidePanel`).
- Primitivos shadcn (`src/components/ui/*`) fazem ponte para os tokens `--vyd-*` em
  `src/styles/globals.css`. `vyd-react` está instalado, mas ainda não adotado nos
  componentes (adoção futura).
