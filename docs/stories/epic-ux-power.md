# Épico: UX Power — Experiência de Poder do Usuário

**Epic ID:** EPIC-UX-POWER
**PRD:** [docs/prd/prd-ux-power.md](../prd/prd-ux-power.md)
**Prioridade:** P0/P1
**Status:** Draft
**Criado em:** 2026-06-23
**Origem:** Deep research em projetos OSS do GitHub (jun/2026) — 101 agentes, 13 claims verificados

---

## Contexto

O VYD Engage tem base funcional sólida. O próximo salto de valor é fazer o usuário **mover-se mais rápido** dentro do que já existe — eliminando atrito de navegação, retrabalho de filtros e limitações de automação para cadências SDR.

---

## Stories

### Fase 1 — Navegação (Sprint 1, P0)

| Story | Título | Pontos | Status | Paralelo com |
|-------|--------|--------|--------|-------------|
| [UX-1.1](ux-1.1-command-palette.md) | Command Palette Global (Ctrl+K) | 5 | Draft | UX-1.2, UX-2.1, UX-3.1 |
| [UX-1.2](ux-1.2-side-panel.md) | Side Panel — Quick View | 5 | Draft | UX-1.1, UX-2.1, UX-3.1 |

### Fase 2 — Filtros e Views (Sprint 1-2, P0)

| Story | Título | Pontos | Status | Dependência |
|-------|--------|--------|--------|------------|
| [UX-2.1](ux-2.1-filter-builder.md) | Filtros Avançados com Query Builder Visual | 8 | Draft | Nenhuma |
| [UX-2.2](ux-2.2-views-deals-companies.md) | Views Salvas em Deals e Empresas | 3 | Draft | UX-2.1 |

### Fase 3 — Pipeline Visual (Sprint 1, P1)

| Story | Título | Pontos | Status | Paralelo com |
|-------|--------|--------|--------|-------------|
| [UX-3.1](ux-3.1-pipeline-visual.md) | Pipeline Kanban com Feedback Visual de Drag | 5 | Draft | Fases 1 e 2 |

### Fase 4 — SDR Sequences (Sprint 2, P1)

| Story | Título | Pontos | Status | Dependência |
|-------|--------|--------|--------|------------|
| [UX-4.1](ux-4.1-delay-step-automations.md) | Delay Step no Engine de Automações | 8 | Draft | Nenhuma |

---

## Grafo de Dependências

```
UX-1.1 ─── independente (Sprint 1, paralelo)
UX-1.2 ─── independente (Sprint 1, paralelo)
UX-2.1 ─── independente (Sprint 1, paralelo)
UX-2.2 ─── depende de UX-2.1 (Sprint 2)
UX-3.1 ─── independente (Sprint 1, paralelo)
UX-4.1 ─── independente (Sprint 2)
```

**Sprint 1 paralelo:** UX-1.1, UX-1.2, UX-2.1, UX-3.1 (total: 23 pontos)
**Sprint 2:** UX-2.2, UX-4.1 — e UX-2.2 só inicia após UX-2.1 done (total: 11 pontos)

---

## Total

| Fase | Stories | Pontos |
|------|---------|--------|
| Navegação | 2 | 10 |
| Filtros | 2 | 11 |
| Pipeline | 1 | 5 |
| Automações | 1 | 8 |
| **Total** | **6** | **34** |

---

## Próximos Passos

1. **@po (Pax)** — `*validate-story-draft` em cada story (checklist 10 pontos)
2. **@dev (Dex)** — Sprint 1: UX-1.1, UX-1.2, UX-2.1, UX-3.1 em paralelo
3. **@qa (Quinn)** — QA gate por story ao completar implementação
4. **@devops (Gage)** — push + PR após cada story aprovada em QA
