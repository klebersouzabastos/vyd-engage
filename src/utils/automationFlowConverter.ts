// Types for the visual builder
export interface FlowNode {
  id: string;
  type: "trigger" | "action" | "condition";
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
  { value: "lead_created", label: "Lead Criado" },
  { value: "lead_updated", label: "Lead Atualizado" },
  { value: "status_changed", label: "Status Alterado" },
  { value: "tag_added", label: "Tag Adicionada" },
  { value: "deal_created", label: "Deal Criado" },
  { value: "deal_stage_changed", label: "Estágio do Deal Alterado" },
  { value: "task_completed", label: "Tarefa Concluída" },
  { value: "form_submitted", label: "Formulário Preenchido" },
] as const;

// Action types and their labels
export const ACTION_TYPES = [
  { value: "send_email", label: "Enviar E-mail", icon: "email" },
  { value: "create_task", label: "Criar Tarefa", icon: "task" },
  { value: "update_field", label: "Atualizar Campo", icon: "update" },
  { value: "add_tag", label: "Adicionar Tag", icon: "tag" },
  { value: "remove_tag", label: "Remover Tag", icon: "untag" },
  { value: "send_webhook", label: "Enviar Webhook", icon: "webhook" },
  { value: "wait_delay", label: "Aguardar", icon: "delay" },
  { value: "send_whatsapp", label: "Enviar WhatsApp", icon: "whatsapp" },
] as const;

// Condition operators
export const CONDITION_OPERATORS = [
  { value: "equals", label: "igual a" },
  { value: "not_equals", label: "diferente de" },
  { value: "contains", label: "contém" },
  { value: "greater_than", label: "maior que" },
  { value: "less_than", label: "menor que" },
  { value: "is_empty", label: "está vazio" },
  { value: "is_not_empty", label: "não está vazio" },
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
 */
export function flowToAutomation(flowData: FlowData): {
  trigger: any;
  steps: any[];
  conditions: any;
} {
  const { nodes, edges } = flowData;

  // Find the trigger node
  const triggerNode = nodes.find((n) => n.type === "trigger");
  if (!triggerNode) {
    return { trigger: { type: "lead_created" }, steps: [], conditions: null };
  }

  const trigger: any = {
    type: triggerNode.data.nodeType,
    ...triggerNode.data.config,
  };

  // Walk the graph from the trigger node to build ordered steps
  const steps: any[] = [];
  const visited = new Set<string>();

  function walkNode(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = nodes.find((n) => n.id === nodeId);
    if (!node || node.type === "trigger") {
      // continue to children
      const outEdges = edges.filter((e) => e.source === nodeId);
      for (const edge of outEdges) {
        walkNode(edge.target);
      }
      return;
    }

    if (node.type === "condition") {
      const trueEdge = edges.find(
        (e) => e.source === nodeId && e.sourceHandle === "true"
      );
      const falseEdge = edges.find(
        (e) => e.source === nodeId && e.sourceHandle === "false"
      );

      steps.push({
        order: steps.length,
        type: "condition",
        config: {
          field: node.data.config.field || "status",
          operator: node.data.config.operator || "equals",
          value: node.data.config.value || "",
          logic: node.data.config.logic || "AND",
          conditions: node.data.config.conditions || [],
          trueBranch: trueEdge?.target || null,
          falseBranch: falseEdge?.target || null,
        },
      });

      if (trueEdge) walkNode(trueEdge.target);
      if (falseEdge) walkNode(falseEdge.target);
    } else {
      // Action node
      const actionType = node.data.nodeType;
      let delay = "0";

      if (actionType === "wait_delay") {
        delay =
          node.data.config.delay ||
          `${node.data.config.duration || 1}${node.data.config.unit || "d"}`;
      }

      steps.push({
        order: steps.length,
        type: actionType,
        delay,
        config: { ...node.data.config },
      });

      // Continue to next
      const outEdges = edges.filter((e) => e.source === nodeId);
      for (const edge of outEdges) {
        walkNode(edge.target);
      }
    }
  }

  // Start walk from trigger's outgoing edges
  const triggerEdges = edges.filter((e) => e.source === triggerNode.id);
  for (const edge of triggerEdges) {
    walkNode(edge.target);
  }

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
    typeof automation.trigger === "string"
      ? { type: automation.trigger }
      : automation.trigger || { type: "lead_created" };

  const triggerNodeId = generateNodeId();
  const triggerLabel =
    TRIGGER_TYPES.find((t) => t.value === triggerData.type)?.label ||
    triggerData.type;

  nodes.push({
    id: triggerNodeId,
    type: "trigger",
    position: { x: centerX, y: currentY },
    data: {
      nodeType: triggerData.type,
      label: triggerLabel,
      config: { ...triggerData },
    },
  });

  currentY += ySpacing;

  // Create step nodes
  const apiSteps = Array.isArray(automation.steps) ? automation.steps : [];
  let prevNodeId = triggerNodeId;

  for (const step of apiSteps) {
    const nodeId = generateNodeId();
    const isCondition = step.type === "condition";

    const actionLabel = isCondition
      ? "Condição"
      : ACTION_TYPES.find((a) => a.value === step.type)?.label || step.type;

    nodes.push({
      id: nodeId,
      type: isCondition ? "condition" : "action",
      position: { x: centerX, y: currentY },
      data: {
        nodeType: step.type,
        label: actionLabel,
        config: { ...step.config, delay: step.delay },
      },
    });

    edges.push({
      id: generateEdgeId(prevNodeId, nodeId),
      source: prevNodeId,
      target: nodeId,
    });

    prevNodeId = nodeId;
    currentY += ySpacing;
  }

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
        type: "trigger",
        position: { x: 300, y: 60 },
        data: {
          nodeType: "lead_created",
          label: "Lead Criado",
          config: {},
        },
      },
    ],
    edges: [],
  };
}
