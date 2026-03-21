import { useState, useCallback } from "react";
import { NodePalette } from "./NodePalette";
import { BuilderCanvas } from "./BuilderCanvas";
import {
  generateNodeId,
  generateEdgeId,
  TRIGGER_TYPES,
  ACTION_TYPES,
  flowToAutomation,
} from "../../utils/automationFlowConverter";
import type { FlowNode, FlowEdge, FlowData } from "../../utils/automationFlowConverter";
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
  const [description, setDescription] = useState(initialDescription);
  const [isActive, setIsActive] = useState(initialActive);
  const [nodes, setNodes] = useState<FlowNode[]>(initialFlowData.nodes);
  const [edges, setEdges] = useState<FlowEdge[]>(initialFlowData.edges);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const hasTrigger = nodes.some((n) => n.type === "trigger");

  const handleAddNode = useCallback(
    (type: "trigger" | "action" | "condition", nodeType: string) => {
      // Calculate position: below the last node
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

      const newNode: FlowNode = {
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

      const newNodes = [...nodes, newNode];
      setNodes(newNodes);

      // Auto-connect: if there's a preceding node (last node before this one), add edge
      if (nodes.length > 0) {
        const lastNode = nodes[nodes.length - 1];
        // Only auto-connect if the last node isn't already fully connected
        const lastNodeEdges = edges.filter((e) => e.source === lastNode.id);
        if (lastNode.type !== "condition" && lastNodeEdges.length === 0) {
          const newEdge: FlowEdge = {
            id: generateEdgeId(lastNode.id, nodeId),
            source: lastNode.id,
            target: nodeId,
          };
          setEdges([...edges, newEdge]);
        } else if (lastNode.type === "condition") {
          // Auto-connect to the "true" handle if not yet connected
          const trueEdge = lastNodeEdges.find((e) => e.sourceHandle === "true");
          if (!trueEdge) {
            const newEdge: FlowEdge = {
              id: generateEdgeId(lastNode.id, nodeId),
              source: lastNode.id,
              target: nodeId,
              sourceHandle: "true",
            };
            setEdges([...edges, newEdge]);
          }
        }
      }

      setSelectedNode(nodeId);
    },
    [nodes, edges]
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((prev) => prev.filter((n) => n.id !== nodeId));
      setEdges((prev) =>
        prev.filter((e) => e.source !== nodeId && e.target !== nodeId)
      );
      if (selectedNode === nodeId) setSelectedNode(null);
    },
    [selectedNode]
  );

  const handleUpdateNodeConfig = useCallback(
    (nodeId: string, config: Record<string, any>) => {
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== nodeId) return n;

          // Handle _nodeType and _label special keys for type changes
          const newNodeType = config._nodeType || n.data.nodeType;
          const newLabel = config._label || n.data.label;
          const cleanConfig = { ...config };
          delete cleanConfig._nodeType;
          delete cleanConfig._label;

          return {
            ...n,
            data: {
              ...n.data,
              nodeType: newNodeType,
              label: newLabel,
              config: cleanConfig,
            },
          };
        })
      );
    },
    []
  );

  const handleSave = () => {
    if (!name.trim()) return;

    const flowData: FlowData = { nodes, edges };
    const { trigger, steps, conditions } = flowToAutomation(flowData);

    onSave({
      name,
      description,
      isActive,
      flowData,
      trigger,
      steps,
      conditions,
    });
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
            <span className="text-sm text-gray-600">
              {isActive ? "Ativo" : "Inativo"}
            </span>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
          <Button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="gap-2"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            Salvar
          </Button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        <NodePalette onAddNode={handleAddNode} hasTrigger={hasTrigger} />
        <BuilderCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={setNodes}
          onEdgesChange={setEdges}
          selectedNode={selectedNode}
          onSelectNode={setSelectedNode}
          onDeleteNode={handleDeleteNode}
          onUpdateNodeConfig={handleUpdateNodeConfig}
        />
      </div>
    </div>
  );
}
