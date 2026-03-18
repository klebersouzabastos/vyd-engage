# QA Gate Review: Calendar Views for Tasks (RETRO-CALENDAR)

**Reviewer:** Quinn (@qa)
**Date:** 2026-03-18
**Story ID:** RETRO-CALENDAR
**Verdict:** PASS

---

## Score Summary

| Criteria | Score (1-5) | Notes |
|----------|-------------|-------|
| 1. Functionality | 5 | 4 view modes (list/month/week/agenda), drag-and-drop, quick add, popover |
| 2. Security | 4 | Routes protected with auth + tenant; date range filtering validated with Zod |
| 3. Error Handling | 3 | Most errors handled by hooks; some silent catches in calendar handlers |
| 4. Performance | 4 | Date range fetching limits data; groupTasksByDate is O(n); uses useMemo well |
| 5. Code Quality | 4 | Clean separation of concerns, proper utility module, consistent naming |
| 6. Accessibility | 2 | Drag-and-drop is mouse-only; calendar grid lacks ARIA roles |
| 7. Mobile/Responsive | 4 | Smart mobile defaults (agenda view), dots on mobile month, responsive week |

**Average Score: 3.7 / 5**

---

## Issues Found

### CRITICAL

*None*

### MAJOR

#### M1. Calendar grid cells lack semantic HTML and ARIA roles
- **File:** `src/components/calendar/CalendarMonthView.tsx:69-142`
- **Issue:** The month grid is built with plain `<div>` elements. Screen readers have no way to understand this is a calendar. The grid should use `role="grid"`, rows should use `role="row"`, and cells `role="gridcell"` with `aria-label` indicating the date.
- **Recommendation:** Add ARIA grid roles or use a `<table>` with proper semantics for the calendar grid.

#### M2. Week view day header format falls back to English
- **File:** `src/components/calendar/CalendarWeekView.tsx:81`
- **Issue:** `format(day, "EEE", { locale: undefined })` explicitly passes `locale: undefined`, which causes date-fns to use the default English locale instead of ptBR. Days will display as "Sun", "Mon" instead of "Dom", "Seg".
- **Recommendation:** Import and use `ptBR` locale: `format(day, "EEE", { locale: ptBR })`.

### MINOR

#### m1. Tasks page fetches with `limit: 200` for calendar views
- **File:** `src/pages/Tasks.tsx:213`
- **Issue:** `fetchTasks({ startDate, endDate, limit: 200 })` hard-codes a limit of 200. For a month view, a tenant with heavy task usage could have more than 200 tasks, resulting in missing tasks on the calendar.
- **Recommendation:** Either remove the limit for date-range queries (the date range already bounds the result set) or implement pagination.

#### m2. Agenda view hardcodes 14-day window without pagination
- **File:** `src/components/calendar/CalendarAgendaView.tsx:48-56`
- **Issue:** Always shows exactly 14 days. There is no way to see tasks further in the future from the agenda view without switching to month view.
- **Recommendation:** Add a "load more" button or allow configuring the window size.

#### m3. CalendarQuickAdd does not reset state on `defaultDate` change
- **File:** `src/components/calendar/CalendarQuickAdd.tsx:27-29`
- **Issue:** `title` and `priority` state are initialized with `useState` defaults but are not reset when `defaultDate` changes (e.g., opening quick add on different dates). If the user opens quick add, types a title, cancels, then opens on a different date, the old title persists until the dialog is closed via `handleOpenChange`.
- **Recommendation:** Add a `useEffect` that resets `title` and `priority` when `open` changes to `true`.

#### m4. `handleCalendarNavigate` for agenda mode navigates by 14 days instead of a meaningful unit
- **File:** `src/pages/Tasks.tsx:218-225`
- **Issue:** When in agenda mode, prev/next navigate by 14 days (`addDays(prev, 14)` / `subDays(prev, 14)`). But `CalendarAgendaView` always starts from `new Date()` (line 575), ignoring `calendarDate`. So the navigation buttons have no visible effect in agenda mode.
- **Recommendation:** Either pass `calendarDate` as `startDate` to `CalendarAgendaView`, or hide the nav buttons in agenda mode.

#### m5. `CalendarHeader` has an empty spacer div for layout balance
- **File:** `src/components/calendar/CalendarHeader.tsx:46`
- **Issue:** `<div className="w-[140px]" />` is used as a visual spacer. This is fragile and breaks if the left nav buttons change width.
- **Recommendation:** Use flexbox `justify-center` for the title or a more robust centering approach.

#### m6. `calendarUtils.ts` re-exports date-fns functions directly
- **File:** `src/components/calendar/calendarUtils.ts:119`
- **Issue:** `export { isSameDay, isToday, ... }` re-exports 10+ date-fns functions. This creates a pass-through barrel that adds indirection. Components could import directly from date-fns.
- **Recommendation:** Keep only custom utility functions in calendarUtils. Let components import date-fns directly where needed.

### SUGGESTION

#### S1. Add keyboard alternative for drag-and-drop task rescheduling
- **Files:** `CalendarMonthView.tsx`, `CalendarWeekView.tsx`
- **Issue:** Rescheduling tasks via drag-and-drop is mouse-only. Keyboard users cannot reschedule tasks from the calendar.
- **Recommendation:** Add a date picker in the task popover to allow keyboard-accessible rescheduling.

#### S2. Consider `aria-current="date"` for today's date
- **Files:** `CalendarMonthView.tsx:93`, `CalendarWeekView.tsx:86`
- **Issue:** Today is visually highlighted but not marked semantically.
- **Recommendation:** Add `aria-current="date"` to the today cell for screen reader users.

#### S3. Add visual drag feedback (ghost/placeholder)
- **Files:** `CalendarMonthView.tsx`, `CalendarWeekView.tsx`
- **Issue:** During drag, there is no visual placeholder in the target cell to indicate where the task will land.
- **Recommendation:** Add a drop zone indicator (e.g., dashed border or highlight) on `dragOver`.

#### S4. Tasks route should validate startDate <= endDate
- **File:** `server/src/routes/tasks.ts:29-40`
- **Issue:** The query schema accepts `startDate` and `endDate` independently. There is no validation that `startDate <= endDate`. Reversed dates would return no results silently.
- **Recommendation:** Add a Zod `.refine()` to validate date ordering when both are provided.

---

## Files Reviewed

| File | Lines | Status |
|------|-------|--------|
| `src/pages/Tasks.tsx` | 631 | Reviewed |
| `src/components/calendar/CalendarMonthView.tsx` | 146 | Reviewed |
| `src/components/calendar/CalendarWeekView.tsx` | 128 | Reviewed |
| `src/components/calendar/CalendarAgendaView.tsx` | 152 | Reviewed |
| `src/components/calendar/CalendarHeader.tsx` | 49 | Reviewed |
| `src/components/calendar/CalendarTaskChip.tsx` | 77 | Reviewed |
| `src/components/calendar/CalendarTaskPopover.tsx` | 137 | Reviewed |
| `src/components/calendar/CalendarQuickAdd.tsx` | 104 | Reviewed |
| `src/components/calendar/calendarUtils.ts` | 119 | Reviewed |
| `server/src/routes/tasks.ts` | 150 | Reviewed |

---

## Follow-up Backlog Items

1. **[BUG]** Fix week view locale -- pass `ptBR` locale to `format(day, "EEE")` in `CalendarWeekView.tsx:81`
2. **[BUG]** Fix agenda view navigation -- either wire `calendarDate` to AgendaView startDate or hide nav in agenda mode
3. **[A11Y]** Add ARIA grid roles to calendar month/week views
4. **[A11Y]** Add `aria-current="date"` to today cells
5. **[A11Y]** Add keyboard-accessible task rescheduling (date picker in popover)
6. **[UX]** Add drag-over visual feedback (drop zone indicator)
7. **[UX]** Add "load more" to agenda view for dates beyond 14 days
8. **[SEC]** Add Zod refinement to validate `startDate <= endDate` in tasks query schema
