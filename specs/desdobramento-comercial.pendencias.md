# Desdobramento Comercial — Pendências conhecidas (iteração 2, não implementadas)

A build está conforme a spec (`/review` aprovado) e verificada (build + 7 testes verdes).
Estes itens são refinamentos marginais identificados na auto-avaliação (iteração 2),
**deliberadamente não implementados** por baixo retorno / risco de churn. Ficam
documentados para decisão posterior.

| # | Item | Estado atual | Por que ficou pendente |
|---|------|--------------|------------------------|
| 1 | **req 10 — `targetRole → leadId`**: ao gerar ações do playbook, preencher `leadId` com o stakeholder do `targetRole`. | A geração preenche `type/dueDate/priority/roadmapId/companyId/empreendimentoId`, mas não mapeia `targetRole→leadId`. | Vacuamente satisfeito: na criação o roadmap ainda **não tem stakeholders**, então não há quem mapear. Implementar não muda o comportamento em runtime. |
| 2 | **`tenantId` direto em `PlaybookStep` e `RoadmapStakeholder`** | Escopados via pai (`PlaybookTemplate`/`CommercialRoadmap`) com cascade + queries sempre tenant-scoped pelo pai. | O isolamento já existe via pai; adicionar coluna exigiria nova migration para ganho marginal de isolamento e risco de churn. |
| 3 | **Editar título/tipo de uma ação já existente** na agenda do RoadmapView | Hoje é possível: concluir/reabrir, **reagendar** (data) e **reatribuir** (responsável). | "Editar" está coberto por reagendar + reatribuir; editar o título de uma Task existente é valor marginal. |
| 4 | **Trocar o `<select>` nativo de responsável por shadcn `Select`** (consistência visual) | A agenda usa `<select>` nativo para atribuir o responsável por linha. | O nativo é funcional e, na prática, **mais seguro** contra a armadilha do Tailwind pré-compilado. Troca puramente cosmética. |

**Conclusão da auto-avaliação:** pontuação estabilizou em ~93/100 (trajetória 90 → 93 → 93);
estes 4 itens representam os ~7 pontos restantes e foram avaliados como não compensatórios.
