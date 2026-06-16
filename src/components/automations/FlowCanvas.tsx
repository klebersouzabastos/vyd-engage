import { createContext, useContext, useState, useCallback } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
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
  type OnConnectEnd,
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
  /**
   * Connect-to-create: chamado quando o usuário solta uma conexão em área vazia.
   * Recebe a posição (coords do grafo), a posição na tela (para posicionar o
   * menu) e o nó/handle de origem.
   */
  onConnectToCreate: (params: {
    flowPosition: { x: number; y: number };
    screen: { x: number; y: number };
    sourceNodeId: string;
    sourceHandleId: string | null;
  }) => void;
}

/** Renderiza o <ReactFlow>; precisa estar DENTRO de <ReactFlowProvider> para usar useReactFlow. */
function FlowCanvasInner({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onAutoLayout,
  onConnectToCreate,
}: Omit<FlowCanvasProps, "onUpdateNodeConfig" | "onDeleteNode">) {
  const { screenToFlowPosition } = useReactFlow();

  // Cap: handles de condição (true/false) aceitam só 1 aresta de saída; demais
  // fontes permitem fan-out ilimitado. Bloqueia self-loop.
  const isValidConnection = useCallback(
    (c: Connection | Edge) => {
      if (c.source === c.target) return false;
      if (c.sourceHandle === "true" || c.sourceHandle === "false") {
        return !edges.some((e) => e.source === c.source && e.sourceHandle === c.sourceHandle);
      }
      return true;
    },
    [edges],
  );

  const onConnectEnd: OnConnectEnd = useCallback(
    (event, connectionState) => {
      // Conexão válida concluída sobre um handle → onConnect já tratou.
      if (connectionState.isValid) return;
      // Soltou sobre um nó/handle (inválido) → não cria nó.
      if (connectionState.toNode || connectionState.toHandle) return;

      const sourceNodeId = connectionState.fromNode?.id;
      if (!sourceNodeId) return;
      const sourceHandleId = connectionState.fromHandle?.id ?? null;

      const point =
        "changedTouches" in event ? event.changedTouches[0] : (event as MouseEvent);
      const screen = { x: point.clientX, y: point.clientY };
      const flowPosition = screenToFlowPosition(screen);

      onConnectToCreate({ flowPosition, screen, sourceNodeId, sourceHandleId });
    },
    [screenToFlowPosition, onConnectToCreate],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onConnectEnd={onConnectEnd}
      isValidConnection={isValidConnection}
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
  );
}

export function FlowCanvas({
  onUpdateNodeConfig,
  onDeleteNode,
  ...inner
}: FlowCanvasProps) {
  return (
    <div className="flex-1 h-full">
      <ReactFlowProvider>
        <BuilderCallbacksContext.Provider value={{ onUpdateNodeConfig, onDeleteNode }}>
          <FlowCanvasInner {...inner} />
        </BuilderCallbacksContext.Provider>
      </ReactFlowProvider>
    </div>
  );
}
