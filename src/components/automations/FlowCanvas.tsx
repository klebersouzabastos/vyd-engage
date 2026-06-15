import { createContext, useContext, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  type Connection,
  type OnNodesChange,
  type OnEdgesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { LayoutGrid } from "lucide-react";
import type { FlowNode } from "../../utils/automationFlowConverter";
import { TriggerNode } from "./TriggerNode";
import { ActionNode } from "./ActionNode";
import { ConditionNode } from "./ConditionNode";

/**
 * Callbacks shared with the custom nodes (config update / delete). Provided via
 * context so node `data` stays serializable (the converter reads data only).
 */
interface BuilderCallbacks {
  onUpdateNodeConfig: (nodeId: string, config: Record<string, unknown>) => void;
  onDeleteNode: (nodeId: string) => void;
}
const BuilderCallbacksContext = createContext<BuilderCallbacks>({
  onUpdateNodeConfig: () => {},
  onDeleteNode: () => {},
});
const useBuilderCallbacks = () => useContext(BuilderCallbacksContext);

/** Adapts an @xyflow node into the existing FlowNode shape used by the node cards. */
function toFlowNode(id: string, type: FlowNode["type"], data: unknown): FlowNode {
  return { id, type, position: { x: 0, y: 0 }, data } as unknown as FlowNode;
}

function TriggerFlowNode({ id, data, selected }: NodeProps) {
  const { onUpdateNodeConfig, onDeleteNode } = useBuilderCallbacks();
  const [showConfig, setShowConfig] = useState(false);
  return (
    <div className="relative">
      <TriggerNode
        node={toFlowNode(id, "trigger", data)}
        selected={!!selected}
        onSelect={() => {}}
        onUpdate={(config) => onUpdateNodeConfig(id, config)}
        onDelete={() => onDeleteNode(id)}
        showConfig={showConfig}
        onToggleConfig={() => setShowConfig((s) => !s)}
      />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

function ActionFlowNode({ id, data, selected }: NodeProps) {
  const { onUpdateNodeConfig, onDeleteNode } = useBuilderCallbacks();
  const [showConfig, setShowConfig] = useState(false);
  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} />
      <ActionNode
        node={toFlowNode(id, "action", data)}
        selected={!!selected}
        onSelect={() => {}}
        onUpdate={(config) => onUpdateNodeConfig(id, config)}
        onDelete={() => onDeleteNode(id)}
        showConfig={showConfig}
        onToggleConfig={() => setShowConfig((s) => !s)}
      />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

function ConditionFlowNode({ id, data, selected }: NodeProps) {
  const { onUpdateNodeConfig, onDeleteNode } = useBuilderCallbacks();
  const [showConfig, setShowConfig] = useState(false);
  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} />
      <ConditionNode
        node={toFlowNode(id, "condition", data)}
        selected={!!selected}
        onSelect={() => {}}
        onUpdate={(config) => onUpdateNodeConfig(id, config)}
        onDelete={() => onDeleteNode(id)}
        showConfig={showConfig}
        onToggleConfig={() => setShowConfig((s) => !s)}
      />
      {/* true branch (bottom, green) and false branch (right, red) */}
      <Handle id="true" type="source" position={Position.Bottom} style={{ background: "#22c55e" }} />
      <Handle id="false" type="source" position={Position.Right} style={{ background: "#ef4444" }} />
    </div>
  );
}

const nodeTypes = {
  trigger: TriggerFlowNode,
  action: ActionFlowNode,
  condition: ConditionFlowNode,
};

interface FlowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;
  onUpdateNodeConfig: (nodeId: string, config: Record<string, unknown>) => void;
  onDeleteNode: (nodeId: string) => void;
  onAutoLayout: () => void;
}

export function FlowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onUpdateNodeConfig,
  onDeleteNode,
  onAutoLayout,
}: FlowCanvasProps) {
  return (
    <div className="flex-1 h-full">
      <BuilderCallbacksContext.Provider value={{ onUpdateNodeConfig, onDeleteNode }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode={["Backspace", "Delete"]}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} color="#e5e7eb" />
          <Controls />
          <MiniMap pannable zoomable />
          <Panel position="top-right">
            <button
              onClick={onAutoLayout}
              className="flex items-center gap-1.5 bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <LayoutGrid size={14} />
              Auto-organizar
            </button>
          </Panel>
        </ReactFlow>
      </BuilderCallbacksContext.Provider>
    </div>
  );
}
