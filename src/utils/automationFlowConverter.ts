// Types for the visual builder
export interface FlowNode {
  id: string;
  type: 'trigger' | 'action' | 'condition';
  position: { x: number; y: number };
  data: {
    nodeType: string; // e.g., "lead_created", "send_email", "condition"
    label: string;
    config: Record<string, any>;
  };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string; // "true" | "false" for condition branches
  label?: string;
}

export interface FlowData {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

// Trigger types and their labels
export const TRIGGER_TYPES = [
  { value: 'lead_created', label: 'Lead Criado' },
  { value: 'lead_updated', label: 'Lead Atualizado' },
  { value: 'status_changed', label: 'Status Alterado' },
  { value: 'tag_added', label: 'Tag Adicionada' },
  { value: 'deal_created', label: 'Deal Criado' },
  { value: 'deal_stage_changed', label: 'Estágio do Deal Alterado' },
  { value: 'task_completed', label: 'Tarefa Concluída' },
  { value: 'form_submitted', label: 'Formulário Preenchido' },
] as const;

// Action types and their labels
export const ACTION_TYPES = [
  { value: 'send_email', label: 'Enviar E-mail', icon: 'email' },
  { value: 'create_task', label: 'Criar Tarefa', icon: 'task' },
  { value: 'update_field', label: 'Atualizar Campo', icon: 'update' },
  { value: 'add_tag', label: 'Adicionar Tag', icon: 'tag' },
  { value: 'remove_tag', label: 'Remover Tag', icon: 'untag' },
  { value: 'send_webhook', label: 'Enviar Webhook', icon: 'webhook' },
  { value: 'wait_delay', label: 'Aguardar', icon: 'delay' },
  { value: 'send_whatsapp', label: 'Enviar WhatsApp', icon: 'whatsapp' },
] as const;

// Condition operators
export const CONDITION_OPERATORS = [
  { value: 'equals', label: 'igual a' },
  { value: 'not_equals', label: 'diferente de' },
  { value: 'contains', label: 'contém' },
  { value: 'greater_than', label: 'maior que' },
  { value: 'less_than', label: 'menor que' },
  { value: 'is_empty', label: 'está vazio' },
  { value: 'is_not_empty', label: 'não está vazio' },
] as const;

let _nodeIdCounter = 0;
export function generateNodeId(): string {
  _nodeIdCounter++;
  return `node_${Date.now()}_${_nodeIdCounter}`;
}

export function generateEdgeId(source: string, target: string): string {
  return `edge_${source}_${target}`;
}

/**
 * Convert visual flow (nodes/edges) to the backend Automation format
 * (trigger, steps, conditions).
 *
 * Modelo de GRAFO (não-linear): cada step carrega `id` (= node id) e `next`
 * (ids dos próximos nós), preservando fan-out (1→N) e ramos de condição
 * (`trueNext`/`falseNext`). O engine caminha o grafo por id em vez de índice.
 * O gatilho carrega `entry` = ids dos nós conectados diretamente a ele.
 *
 * Normalização de vocabulário UI→engine feita aqui (fonte única da verdade):
 *  - `update_field` (field/value) → `update_lead` ({ [field]: value })
 *  - `wait_delay` (duration/unit) → `delay`
 */
export function flowToAutomation(flowData: FlowData): {
  trigger: any;
  steps: any[];
  conditions: any;
} {
  const { nodes, edges } = flowData;

  const triggerNode = nodes.find((n) => n.type === 'trigger');
  if (!triggerNode) {
    return { trigger: { type: 'lead_created', entry: [] }, steps: [], conditions: null };
  }

  // Ids dos alvos das arestas que saem de `nodeId` (opcionalmente filtrando por handle).
  const outIds = (nodeId: string, handle?: string): string[] =>
    edges
      .filter(
        (e) =>
          e.source === nodeId && (handle === undefined || (e.sourceHandle || undefined) === handle)
      )
      .map((e) => e.target);

  const trigger: any = {
    type: triggerNode.data.nodeType,
    ...triggerNode.data.config,
    entry: outIds(triggerNode.id),
  };

  const steps: any[] = [];
  const visited = new Set<string>();

  function emit(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = nodes.find((n) => n.id === nodeId);
    if (!node || node.type === 'trigger') return;

    if (node.type === 'condition') {
      const trueNext = outIds(nodeId, 'true');
      const falseNext = outIds(nodeId, 'false');

      steps.push({
        id: nodeId,
        order: steps.length,
        type: 'condition',
        config: {
          field: node.data.config.field || 'status',
          operator: node.data.config.operator || 'equals',
          value: node.data.config.value ?? '',
          logic: node.data.config.logic || 'AND',
          conditions: node.data.config.conditions || [],
        },
        trueNext,
        falseNext,
      });

      [...trueNext, ...falseNext].forEach(emit);
      return;
    }

    // Action node
    const actionType = node.data.nodeType;
    const next = outIds(nodeId);

    if (actionType === 'wait_delay') {
      steps.push({
        id: nodeId,
        order: steps.length,
        type: 'delay',
        delay:
          node.data.config.delay ||
          `${node.data.config.duration || 1}${node.data.config.unit || 'd'}`,
        config: { ...node.data.config },
        next,
      });
    } else if (actionType === 'update_field') {
      // Remapeia o par genérico {field,value} para a chave tipada do engine.
      const field = node.data.config.field || 'status';
      const raw = node.data.config.value;
      const value = field === 'score' ? Number(raw) : raw;
      steps.push({
        id: nodeId,
        order: steps.length,
        type: 'update_lead',
        config: { [field]: value },
        next,
      });
    } else {
      steps.push({
        id: nodeId,
        order: steps.length,
        type: actionType,
        config: { ...node.data.config },
        next,
      });
    }

    next.forEach(emit);
  }

  trigger.entry.forEach(emit);

  return { trigger, steps, conditions: null };
}

/**
 * Convert backend Automation format to visual flow (nodes/edges)
 */
export function automationToFlow(automation: {
  trigger: any;
  steps: any[];
  flowData?: any;
}): FlowData {
  // If flowData already exists, use it directly
  if (automation.flowData?.nodes && automation.flowData?.edges) {
    return automation.flowData as FlowData;
  }

  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  const centerX = 300;
  let currentY = 60;
  const ySpacing = 140;

  // Create trigger node
  const triggerData =
    typeof automation.trigger === 'string'
      ? { type: automation.trigger }
      : automation.trigger || { type: 'lead_created' };

  const triggerNodeId = generateNodeId();
  const triggerLabel =
    TRIGGER_TYPES.find((t) => t.value === triggerData.type)?.label || triggerData.type;

  nodes.push({
    id: triggerNodeId,
    type: 'trigger',
    position: { x: centerX, y: currentY },
    data: {
      nodeType: triggerData.type,
      label: triggerLabel,
      config: { ...triggerData },
    },
  });

  currentY += ySpacing;

  const apiSteps = Array.isArray(automation.steps) ? automation.steps : [];
  const stepNodeId = (s: any, i: number) => s?.id || `step_${i}`;

  // Converte um step (vocabulário do engine) num nó da UI, revertendo os
  // renomes feitos por flowToAutomation para que o card renderize corretamente.
  const toNode = (step: any, i: number): FlowNode => {
    let nodeType = step.type;
    let config: Record<string, any> = { ...step.config, delay: step.delay };

    if (nodeType === 'update_lead') {
      const key = Object.keys(step.config || {})[0] || 'status';
      nodeType = 'update_field';
      config = { field: key, value: step.config?.[key] };
    } else if (nodeType === 'delay') {
      nodeType = 'wait_delay';
      if (config.duration === undefined && step.delay) {
        const m = String(step.delay).match(/^(\d+)\s*([nhdw])$/);
        if (m) {
          config.duration = Number(m[1]);
          config.unit = m[2];
        }
      }
    }

    const isCondition = step.type === 'condition';
    const label = isCondition
      ? 'Condição'
      : ACTION_TYPES.find((a) => a.value === nodeType)?.label || nodeType;

    return {
      id: stepNodeId(step, i),
      type: isCondition ? 'condition' : 'action',
      position: { x: centerX, y: currentY + i * ySpacing },
      data: { nodeType, label, config },
    };
  };

  // Grafo: steps carregam id/next/trueNext/falseNext → preserva fan-out e ramos.
  const isGraph = apiSteps.some(
    (s: any) =>
      s &&
      (s.id || Array.isArray(s.next) || Array.isArray(s.trueNext) || Array.isArray(s.falseNext))
  );

  if (isGraph) {
    apiSteps.forEach((step: any, i: number) => nodes.push(toNode(step, i)));

    // Arestas do gatilho para os nós de entrada.
    const entry: string[] =
      Array.isArray(triggerData.entry) && triggerData.entry.length
        ? triggerData.entry
        : apiSteps[0]
          ? [stepNodeId(apiSteps[0], 0)]
          : [];
    entry.forEach((target) =>
      edges.push({ id: generateEdgeId(triggerNodeId, target), source: triggerNodeId, target })
    );

    // Arestas de cada step (condição usa handles true/false).
    apiSteps.forEach((step: any, i: number) => {
      const source = stepNodeId(step, i);
      if (step.type === 'condition') {
        (step.trueNext || []).forEach((target: string) =>
          edges.push({
            id: `${generateEdgeId(source, target)}_true`,
            source,
            target,
            sourceHandle: 'true',
          })
        );
        (step.falseNext || []).forEach((target: string) =>
          edges.push({
            id: `${generateEdgeId(source, target)}_false`,
            source,
            target,
            sourceHandle: 'false',
          })
        );
      } else {
        (step.next || []).forEach((target: string) =>
          edges.push({ id: generateEdgeId(source, target), source, target })
        );
      }
    });

    return { nodes, edges };
  }

  // Fallback legado: steps lineares sem id/next → encadeia por ordem.
  let prevNodeId = triggerNodeId;
  apiSteps.forEach((step: any, i: number) => {
    const node = toNode(step, i);
    nodes.push(node);
    edges.push({ id: generateEdgeId(prevNodeId, node.id), source: prevNodeId, target: node.id });
    prevNodeId = node.id;
  });

  return { nodes, edges };
}

/**
 * Create a default flow with just a trigger node
 */
export function createDefaultFlow(): FlowData {
  const triggerNodeId = generateNodeId();
  return {
    nodes: [
      {
        id: triggerNodeId,
        type: 'trigger',
        position: { x: 300, y: 60 },
        data: {
          nodeType: 'lead_created',
          label: 'Lead Criado',
          config: {},
        },
      },
    ],
    edges: [],
  };
}
