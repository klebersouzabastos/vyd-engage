# Story Retroativa: Advanced Calendar Views for Tasks

**Story ID:** RETRO-CALENDAR
**Tipo:** Feature (Retroativa)
**Prioridade:** P1
**Origem:** Commit 517d874 — 2026-03-18
**Status:** Done (pendente validação QA)
**Pontos:** 5
**Agente:** @po (Pax) — documentação retroativa

---

## Descrição

Sistema de calendário completo para Tasks com 4 modos de visualização (List, Month, Week, Agenda), navegação temporal, drag-and-drop para reagendamento e quick-add de tarefas diretamente no calendário.

---

## Acceptance Criteria (Retroativos)

### Backend
- [x] `server/src/routes/tasks.ts`: suporte a filtro por date range (startDate, endDate, limit=200)
- [x] `server/src/services/taskService.ts`: filtering por range de datas

### Frontend — Views
- [x] 4 modos de visualização: List, Month, Week, Agenda (toggle no topo)
- [x] **Month View** (`CalendarMonthView.tsx`): grid 7 colunas, task chips (max 3), overflow "x more", drag-and-drop, today highlight, adjacent month days grayed
- [x] **Week View** (`CalendarWeekView.tsx`): 7 colunas DOM-SAB, day header com quick-add, scrollable tasks, drag-and-drop
- [x] **Agenda View** (`CalendarAgendaView.tsx`): lista 14 dias, seções por dia, cards com priority badge e due time, quick-add por dia
- [x] **List View**: agrupamento por status (Overdue, Today, Upcoming, Completed) — já existia, preservado

### Frontend — Navegação e Interação
- [x] `CalendarHeader.tsx`: título formatado, botões Prev/Next/Today, disabled states
- [x] `CalendarTaskChip.tsx`: display compacto com barra de cor por priority, draggable, variante dot para mobile
- [x] `CalendarTaskPopover.tsx`: popover com título, descrição, status, priority, due date, ações (Edit, Complete, Delete)
- [x] `CalendarQuickAdd.tsx`: dialog modal para criação rápida (título, priority, due date pre-filled)
- [x] Drag-and-drop para reagendar task (atualiza dueDate via API + toast)
- [x] Click em célula vazia abre quick-add com data pre-filled

### Frontend — Responsividade
- [x] Mobile: default para Agenda view
- [x] Month view mobile: dots ao invés de chips
- [x] Week view mobile: layout single-column
- [x] Popovers e dialogs responsivos

### Utilitários
- [x] `calendarUtils.ts`: getMonthGridDays, getWeekDays, groupTasksByDate, getDateRangeForView, formatMonthTitle, formatWeekTitle, formatDayHeader, isToday, isSameMonth, addMonths/subMonths/addWeeks/subWeeks/addDays/subDays, startOfWeek

### QA Pendente
- [ ] Testes: criar task via quick-add no month view → verificar que aparece no dia correto
- [ ] Testes: drag-and-drop task de segunda para sexta → verificar dueDate atualizado
- [ ] Testes: navegar entre meses → verificar que tasks carregam corretamente
- [ ] Testes: responsividade em 375px (mobile) → verificar agenda view default e dots no month

---

## Arquivos Modificados

**Backend (2 files):**
- `server/src/routes/tasks.ts` — Date range filtering
- `server/src/services/taskService.ts` — Date range support

**Frontend (9 files):**
- `src/pages/Tasks.tsx` — 4 view modes, navigation, drag handler
- `src/components/calendar/CalendarMonthView.tsx`
- `src/components/calendar/CalendarWeekView.tsx`
- `src/components/calendar/CalendarAgendaView.tsx`
- `src/components/calendar/CalendarHeader.tsx`
- `src/components/calendar/CalendarTaskChip.tsx`
- `src/components/calendar/CalendarTaskPopover.tsx`
- `src/components/calendar/CalendarQuickAdd.tsx`
- `src/components/calendar/calendarUtils.ts`

---

## Riscos Identificados

| Risco | Probabilidade | Impacto | Status |
|-------|--------------|---------|--------|
| Drag-and-drop não funciona em touch devices | Média | Médio | A validar |
| Performance com muitas tasks no month view | Baixa | Baixo | Max 3 chips mitiga |
| Date utils podem ter edge cases com timezone | Baixa | Médio | A validar |

---

*Documentado retroativamente por Pax (PO) — 2026-03-18*
