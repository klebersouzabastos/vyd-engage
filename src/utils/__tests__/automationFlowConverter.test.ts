import { describe, it, expect } from 'vitest';
import { flowToAutomation, automationToFlow } from '../automationFlowConverter';
import type { FlowData } from '../automationFlowConverter';

// Helpers para montar nós/arestas de teste com ids estáveis.
const trigger = (id: string, nodeType = 'lead_created', config = {}) => ({
  id,
  type: 'trigger' as const,
  position: { x: 0, y: 0 },
  data: { nodeType, label: nodeType, config },
});
const action = (id: string, nodeType: string, config: Record<string, any> = {}) => ({
  id,
  type: 'action' as const,
  position: { x: 0, y: 0 },
  data: { nodeType, label: nodeType, config },
});
const condition = (id: string, config: Record<string, any> = {}) => ({
  id,
  type: 'condition' as const,
  position: { x: 0, y: 0 },
  data: { nodeType: 'condition', label: 'Condição', config },
});
const edge = (source: string, target: string, sourceHandle?: string) => ({
  id: `e_${source}_${target}_${sourceHandle ?? ''}`,
  source,
  target,
  sourceHandle,
});

describe('flowToAutomation (modelo de grafo)', () => {
  it('encadeia ação linear via next e popula trigger.entry', () => {
    const flow: FlowData = {
      nodes: [trigger('t1'), action('a1', 'send_email'), action('a2', 'send_whatsapp')],
      edges: [edge('t1', 'a1'), edge('a1', 'a2')],
    } as FlowData;

    const { trigger: trg, steps } = flowToAutomation(flow);
    expect(trg.entry).toEqual(['a1']);
    const email = steps.find((s) => s.id === 'a1');
    const wa = steps.find((s) => s.id === 'a2');
    expect(email.type).toBe('send_email');
    expect(email.next).toEqual(['a2']);
    expect(wa.next).toEqual([]);
  });

  it('preserva fan-out: 1 gatilho → N ações', () => {
    const flow: FlowData = {
      nodes: [trigger('t1'), action('a1', 'send_email'), action('a2', 'create_task')],
      edges: [edge('t1', 'a1'), edge('t1', 'a2')],
    } as FlowData;

    const { trigger: trg, steps } = flowToAutomation(flow);
    expect(trg.entry.sort()).toEqual(['a1', 'a2']);
    expect(steps).toHaveLength(2);
    steps.forEach((s) => expect(s.next).toEqual([]));
  });

  it('condição roteia true/false por sourceHandle', () => {
    const flow: FlowData = {
      nodes: [
        trigger('t1'),
        condition('c1', { field: 'status', operator: 'equals', value: 'WON' }),
        action('a1', 'send_email'),
        action('a2', 'send_whatsapp'),
      ],
      edges: [edge('t1', 'c1'), edge('c1', 'a1', 'true'), edge('c1', 'a2', 'false')],
    } as FlowData;

    const { steps } = flowToAutomation(flow);
    const cond = steps.find((s) => s.id === 'c1');
    expect(cond.type).toBe('condition');
    expect(cond.trueNext).toEqual(['a1']);
    expect(cond.falseNext).toEqual(['a2']);
  });

  it('normaliza update_field (field/value) → update_lead ({ [field]: value })', () => {
    const flow: FlowData = {
      nodes: [trigger('t1'), action('a1', 'update_field', { field: 'status', value: 'WON' })],
      edges: [edge('t1', 'a1')],
    } as FlowData;

    const { steps } = flowToAutomation(flow);
    expect(steps[0].type).toBe('update_lead');
    expect(steps[0].config).toEqual({ status: 'WON' });
  });

  it('update_field de score converte valor para número', () => {
    const flow: FlowData = {
      nodes: [trigger('t1'), action('a1', 'update_field', { field: 'score', value: '80' })],
      edges: [edge('t1', 'a1')],
    } as FlowData;

    const { steps } = flowToAutomation(flow);
    expect(steps[0].config).toEqual({ score: 80 });
  });

  it('normaliza wait_delay → delay', () => {
    const flow: FlowData = {
      nodes: [trigger('t1'), action('a1', 'wait_delay', { duration: 2, unit: 'h' })],
      edges: [edge('t1', 'a1')],
    } as FlowData;

    const { steps } = flowToAutomation(flow);
    expect(steps[0].type).toBe('delay');
    expect(steps[0].config).toMatchObject({ duration: 2, unit: 'h' });
  });

  it('sem gatilho retorna entry vazio e steps vazios', () => {
    const flow: FlowData = { nodes: [action('a1', 'send_email')], edges: [] } as FlowData;
    const { trigger: trg, steps } = flowToAutomation(flow);
    expect(trg.entry).toEqual([]);
    expect(steps).toEqual([]);
  });
});

describe('automationToFlow round-trip (sem flowData)', () => {
  it('preserva fan-out e ramos de condição ao reconstruir do grafo de steps', () => {
    const flow: FlowData = {
      nodes: [
        trigger('t1'),
        condition('c1', { field: 'status', operator: 'equals', value: 'WON' }),
        action('a1', 'send_email'),
        action('a2', 'send_whatsapp'),
        action('a3', 'create_task'),
      ],
      edges: [
        edge('t1', 'c1'),
        edge('t1', 'a3'), // fan-out: gatilho dispara condição E tarefa
        edge('c1', 'a1', 'true'),
        edge('c1', 'a2', 'false'),
      ],
    } as FlowData;

    // flow → backend → flow (sem flowData) → backend
    const back1 = flowToAutomation(flow);
    const rebuilt = automationToFlow({ trigger: back1.trigger, steps: back1.steps });
    const back2 = flowToAutomation(rebuilt);

    // entry preservado (fan-out do gatilho)
    expect(back2.trigger.entry.sort()).toEqual(back1.trigger.entry.sort());

    // ramos da condição preservados
    const cond1 = back1.steps.find((s) => s.id === 'c1');
    const cond2 = back2.steps.find((s) => s.id === 'c1');
    expect(cond2.trueNext).toEqual(cond1.trueNext);
    expect(cond2.falseNext).toEqual(cond1.falseNext);

    // tipos normalizados sobrevivem ao round-trip
    expect(back2.steps.map((s) => s.type).sort()).toEqual(back1.steps.map((s) => s.type).sort());
  });

  it('reverte update_lead → update_field e delay → wait_delay para a UI', () => {
    const steps = [
      { id: 's1', type: 'update_lead', config: { status: 'WON' }, next: ['s2'] },
      { id: 's2', type: 'delay', delay: '3d', config: { duration: 3, unit: 'd' }, next: [] },
    ];
    const flow = automationToFlow({ trigger: { type: 'lead_created', entry: ['s1'] }, steps });
    const nodes = flow.nodes.filter((n) => n.type === 'action');
    expect(nodes.find((n) => n.id === 's1')!.data.nodeType).toBe('update_field');
    expect(nodes.find((n) => n.id === 's1')!.data.config).toMatchObject({
      field: 'status',
      value: 'WON',
    });
    expect(nodes.find((n) => n.id === 's2')!.data.nodeType).toBe('wait_delay');
  });
});
