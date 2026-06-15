import { useCallback, useState } from "react";
import {
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
} from "@xyflow/react";
import { NodePalette } from "./NodePalette";
import { FlowCanvas } from "./FlowCanvas";
import { layoutFlow } from "./flowLayout";
import {
  generateNodeId,
  generateEdgeId,
  TRIGGER_TYPES,
  ACTION_TYPES,
  flowToAutomation,
} from "../../utils/automationFlowConverter";
import type { FlowNode, FlowData } from "../../utils/automationFlowConverter";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { ArrowLeft, Save, Loader2 } from "lucide-react";

interface AutomationBuilderProps {
  initialName: string;
  initialDescription: string;
  initialActive: boolean;
  initialFlowData: FlowData;
  saving: boolean;
  onSave: (data: {
    name: string;
    description: string;
    isActive: boolean;
    flowData: FlowData;
    trigger: any;
    steps: any[];
    conditions: any;
  }) => void;
  onBack: () => void;
}

export function AutomationBuilder({
  initialName,
  initialDescription,
  initialActive,
  initialFlowData,
  saving,
  onSave,
  onBack,
}: AutomationBuilderProps) {
  const [name, setName] = useState(initialName);
  const [description] = useState(initialDescription);
  const [isActive, setIsActive] = useState(initialActive);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialFlowData.nodes as unknown as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialFlowData.edges as unknown as Edge[]);

  const hasTrigger = nodes.some((n) => n.type === "trigger");

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges],
  );

  const handleAddNode = useCallback(
    (type: "trigger" | "action" | "condition", nodeType: string) => {
      const maxY = nodes.length > 0 ? Math.max(...nodes.map((n) => n.position.y)) : -80;
      const centerX = 300;
      const nodeId = generateNodeId();

      let label = nodeType;
      if (type === "trigger") {
        label = TRIGGER_TYPES.find((t) => t.value === nodeType)?.label || nodeType;
      } else if (type === "action") {
        label = ACTION_TYPES.find((a) => a.value === nodeType)?.label || nodeType;
      } else if (type === "condition") {
        label = "Condição";
      }

      const newNode: Node = {
        id: nodeId,
        type,
        position: { x: centerX, y: maxY + 140 },
        data: {
          nodeType,
          label,
          config: type === "condition"
            ? { field: "status", operator: "equals", value: "", logic: "AND" }
            : {},
        },
      };

      setNodes((nds) => [...nds, newNode]);

      // Auto-connect from the previous node when sensible
      if (nodes.length > 0) {
        const lastNode = nodes[nodes.length - 1];
        const lastNodeEdges = edges.filter((e) => e.source === lastNode.id);
        if (lastNode.type !== "condition" && lastNodeEdges.length === 0) {
          setEdges((eds) => [...eds, { id: generateEdgeId(lastNode.id, nodeId), source: lastNode.id, target: nodeId }]);
        } else if (lastNode.type === "condition") {
          const trueEdge = lastNodeEdges.find((e) => e.sourceHandle === "true");
          if (!trueEdge) {
            setEdges((eds) => [...eds, { id: generateEdgeId(lastNode.id, nodeId), source: lastNode.id, target: nodeId, sourceHandle: "true" }]);
          }
        }
      }
    },
    [nodes, edges, setNodes, setEdges],
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    },
    [setNodes, setEdges],
  );

  const handleUpdateNodeConfig = useCallback(
    (nodeId: string, config: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n;
          // _nodeType / _label are special keys used when a node changes its type
          const data = n.data as { nodeType: string; label: string; config: Record<string, unknown> };
          const newNodeType = (config._nodeType as string) || data.nodeType;
          const newLabel = (config._label as string) || data.label;
          const cleanConfig = { ...config };
          delete cleanConfig._nodeType;
          delete cleanConfig._label;
          return { ...n, data: { ...data, nodeType: newNodeType, label: newLabel, config: cleanConfig } };
        }),
      );
    },
    [setNodes],
  );

  const handleAutoLayout = useCallback(() => {
    setNodes((nds) => layoutFlow(nds, edges));
  }, [edges, setNodes]);

  const handleSave = () => {
    if (!name.trim()) return;
    const flowData: FlowData = {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: (n.type || "action") as FlowNode["type"],
        position: n.position,
        data: n.data as unknown as FlowNode["data"],
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? undefined,
        label: typeof e.label === "string" ? e.label : undefined,
      })),
    };
    const { trigger, steps, conditions } = flowToAutomation(flowData);
    onSave({ name, description, isActive, flowData, trigger, steps, conditions });
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top bar */}
      <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
            <ArrowLeft size={16} />
            Voltar
          </Button>
          <div className="h-6 w-px bg-gray-200" />
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da automação"
            className="w-64 h-8 border-0 shadow-none focus-visible:ring-1 text-sm font-medium"
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">{isActive ? "Ativo" : "Inativo"}</span>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
          <Button onClick={handleSave} disabled={saving || !name.trim()} className="gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Salvar
          </Button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        <NodePalette onAddNode={handleAddNode} hasTrigger={hasTrigger} />
        <FlowCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onUpdateNodeConfig={handleUpdateNodeConfig}
          onDeleteNode={handleDeleteNode}
          onAutoLayout={handleAutoLayout}
        />
      </div>
    </div>
  );
}
