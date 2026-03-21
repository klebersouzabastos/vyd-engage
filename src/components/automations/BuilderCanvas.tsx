import { useRef, useState, useCallback, useEffect } from "react";
import type { FlowNode, FlowEdge } from "../../utils/automationFlowConverter";
import { TriggerNode } from "./TriggerNode";
import { ActionNode } from "./ActionNode";
import { ConditionNode } from "./ConditionNode";

interface BuilderCanvasProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  onNodesChange: (nodes: FlowNode[]) => void;
  onEdgesChange: (edges: FlowEdge[]) => void;
  selectedNode: string | null;
  onSelectNode: (id: string | null) => void;
  onDeleteNode: (id: string) => void;
  onUpdateNodeConfig: (nodeId: string, config: Record<string, any>) => void;
}

/**
 * Compute a smooth SVG path between two points.
 * We use a simple bezier for vertical flow.
 */
function computePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): string {
  const midY = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
}

// Node dimensions (matching the w-72 = 288px width)
const NODE_WIDTH = 288;
const NODE_HEADER_HEIGHT = 36;
const NODE_BODY_HEIGHT = 60;
const NODE_HEIGHT = NODE_HEADER_HEIGHT + NODE_BODY_HEIGHT;

export function BuilderCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  selectedNode,
  onSelectNode,
  onDeleteNode,
  onUpdateNodeConfig,
}: BuilderCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [configNodeId, setConfigNodeId] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Connection-drawing state
  const [connectingFrom, setConnectingFrom] = useState<{
    nodeId: string;
    handle: string;
  } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Canvas scroll offset for coordinate calculations
  const getCanvasOffset = useCallback(() => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    return {
      x: canvasRef.current.scrollLeft,
      y: canvasRef.current.scrollTop,
    };
  }, []);

  // Handle node dragging
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      // Only left click, skip if double-click or config panel is open
      if (e.button !== 0) return;
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const offset = getCanvasOffset();
      setDraggingNodeId(nodeId);
      setDragOffset({
        x: e.clientX - rect.left + offset.x - node.position.x,
        y: e.clientY - rect.top + offset.y - node.position.y,
      });
    },
    [nodes, getCanvasOffset]
  );

  useEffect(() => {
    if (!draggingNodeId) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const offset = getCanvasOffset();

      const newX = e.clientX - rect.left + offset.x - dragOffset.x;
      const newY = e.clientY - rect.top + offset.y - dragOffset.y;

      onNodesChange(
        nodes.map((n) =>
          n.id === draggingNodeId
            ? { ...n, position: { x: Math.max(0, newX), y: Math.max(0, newY) } }
            : n
        )
      );
    };

    const handleMouseUp = () => {
      setDraggingNodeId(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggingNodeId, dragOffset, nodes, onNodesChange, getCanvasOffset]);

  // Track mouse for connection line
  useEffect(() => {
    if (!connectingFrom) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const offset = getCanvasOffset();
      setMousePos({
        x: e.clientX - rect.left + offset.x,
        y: e.clientY - rect.top + offset.y,
      });
    };

    const handleMouseUp = () => {
      setConnectingFrom(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [connectingFrom, getCanvasOffset]);

  // Connection handle helpers
  const getOutputPos = (node: FlowNode, handle?: string) => {
    const x = node.position.x + NODE_WIDTH / 2;
    if (node.type === "condition" && handle === "false") {
      return { x: node.position.x + NODE_WIDTH, y: node.position.y + NODE_HEIGHT / 2 };
    }
    return { x, y: node.position.y + NODE_HEIGHT };
  };

  const getInputPos = (node: FlowNode) => {
    return {
      x: node.position.x + NODE_WIDTH / 2,
      y: node.position.y,
    };
  };

  // Handle dropping a connection on a node
  const handleNodeDrop = useCallback(
    (targetNodeId: string) => {
      if (!connectingFrom || connectingFrom.nodeId === targetNodeId) return;

      // Check for existing edge from same source+handle
      const existingIdx = edges.findIndex(
        (e) =>
          e.source === connectingFrom.nodeId &&
          (e.sourceHandle || "") === connectingFrom.handle
      );

      const newEdge: FlowEdge = {
        id: `edge_${connectingFrom.nodeId}_${targetNodeId}_${connectingFrom.handle || "default"}`,
        source: connectingFrom.nodeId,
        target: targetNodeId,
        sourceHandle: connectingFrom.handle || undefined,
      };

      let newEdges: FlowEdge[];
      if (existingIdx >= 0) {
        newEdges = [...edges];
        newEdges[existingIdx] = newEdge;
      } else {
        newEdges = [...edges, newEdge];
      }

      onEdgesChange(newEdges);
      setConnectingFrom(null);
    },
    [connectingFrom, edges, onEdgesChange]
  );

  // Background click to deselect
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.canvas) {
      onSelectNode(null);
      setConfigNodeId(null);
    }
  };

  // Calculate canvas dimensions
  const maxX = Math.max(800, ...nodes.map((n) => n.position.x + NODE_WIDTH + 100));
  const maxY = Math.max(600, ...nodes.map((n) => n.position.y + NODE_HEIGHT + 100));

  return (
    <div
      ref={canvasRef}
      className="flex-1 overflow-auto relative"
      style={{
        backgroundImage:
          "radial-gradient(circle, #e5e7eb 1px, transparent 1px)",
        backgroundSize: "20px 20px",
        backgroundColor: "#fafafa",
      }}
      onClick={handleCanvasClick}
    >
      <div
        data-canvas="true"
        style={{ width: maxX, height: maxY, position: "relative" }}
      >
        {/* SVG layer for edges */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={maxX}
          height={maxY}
          style={{ zIndex: 1 }}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#9ca3af" />
            </marker>
            <marker
              id="arrowhead-green"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#22c55e" />
            </marker>
            <marker
              id="arrowhead-red"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
            </marker>
          </defs>

          {edges.map((edge) => {
            const sourceNode = nodes.find((n) => n.id === edge.source);
            const targetNode = nodes.find((n) => n.id === edge.target);
            if (!sourceNode || !targetNode) return null;

            const start = getOutputPos(sourceNode, edge.sourceHandle);
            const end = getInputPos(targetNode);

            const isTrue = edge.sourceHandle === "true";
            const isFalse = edge.sourceHandle === "false";
            const color = isTrue ? "#22c55e" : isFalse ? "#ef4444" : "#9ca3af";
            const markerId = isTrue
              ? "arrowhead-green"
              : isFalse
              ? "arrowhead-red"
              : "arrowhead";

            return (
              <g key={edge.id}>
                <path
                  d={computePath(start.x, start.y, end.x, end.y)}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  markerEnd={`url(#${markerId})`}
                  className="pointer-events-auto cursor-pointer hover:stroke-[3px]"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Remove edge on click
                    onEdgesChange(edges.filter((ed) => ed.id !== edge.id));
                  }}
                />
                {(isTrue || isFalse) && (
                  <text
                    x={(start.x + end.x) / 2}
                    y={(start.y + end.y) / 2 - 8}
                    textAnchor="middle"
                    className="text-[10px] fill-gray-500 select-none"
                  >
                    {isTrue ? "Sim" : "Não"}
                  </text>
                )}
              </g>
            );
          })}

          {/* Connection line being drawn */}
          {connectingFrom && (() => {
            const sourceNode = nodes.find((n) => n.id === connectingFrom.nodeId);
            if (!sourceNode) return null;
            const start = getOutputPos(sourceNode, connectingFrom.handle);
            return (
              <path
                d={computePath(start.x, start.y, mousePos.x, mousePos.y)}
                fill="none"
                stroke="#6366f1"
                strokeWidth={2}
                strokeDasharray="6 3"
              />
            );
          })()}
        </svg>

        {/* Node layer */}
        {nodes.map((node) => (
          <div
            key={node.id}
            className="absolute"
            style={{
              left: node.position.x,
              top: node.position.y,
              zIndex: selectedNode === node.id ? 20 : 10,
              userSelect: "none",
            }}
            onMouseDown={(e) => handleMouseDown(e, node.id)}
            onMouseUp={() => {
              if (connectingFrom && connectingFrom.nodeId !== node.id) {
                handleNodeDrop(node.id);
              }
            }}
          >
            {node.type === "trigger" && (
              <TriggerNode
                node={node}
                selected={selectedNode === node.id}
                onSelect={() => onSelectNode(node.id)}
                onUpdate={(config) => onUpdateNodeConfig(node.id, config)}
                onDelete={() => onDeleteNode(node.id)}
                showConfig={configNodeId === node.id}
                onToggleConfig={() =>
                  setConfigNodeId(configNodeId === node.id ? null : node.id)
                }
              />
            )}
            {node.type === "action" && (
              <ActionNode
                node={node}
                selected={selectedNode === node.id}
                onSelect={() => onSelectNode(node.id)}
                onUpdate={(config) => onUpdateNodeConfig(node.id, config)}
                onDelete={() => onDeleteNode(node.id)}
                showConfig={configNodeId === node.id}
                onToggleConfig={() =>
                  setConfigNodeId(configNodeId === node.id ? null : node.id)
                }
              />
            )}
            {node.type === "condition" && (
              <ConditionNode
                node={node}
                selected={selectedNode === node.id}
                onSelect={() => onSelectNode(node.id)}
                onUpdate={(config) => onUpdateNodeConfig(node.id, config)}
                onDelete={() => onDeleteNode(node.id)}
                showConfig={configNodeId === node.id}
                onToggleConfig={() =>
                  setConfigNodeId(configNodeId === node.id ? null : node.id)
                }
              />
            )}

            {/* Output handles */}
            {node.type !== "condition" && (
              <div
                className="absolute left-1/2 -translate-x-1/2 -bottom-3 w-6 h-6 bg-white border-2 border-gray-300 rounded-full flex items-center justify-center cursor-crosshair hover:border-indigo-500 hover:bg-indigo-50 transition-colors z-30"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setConnectingFrom({ nodeId: node.id, handle: "" });
                }}
                title="Arrastar para conectar"
              >
                <div className="w-2 h-2 rounded-full bg-gray-400" />
              </div>
            )}
            {node.type === "condition" && (
              <>
                {/* True output (bottom) */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 -bottom-3 w-6 h-6 bg-white border-2 border-green-400 rounded-full flex items-center justify-center cursor-crosshair hover:bg-green-50 transition-colors z-30"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setConnectingFrom({ nodeId: node.id, handle: "true" });
                  }}
                  title="Sim (Verdadeiro)"
                >
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                </div>
                {/* False output (right) */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 -right-3 w-6 h-6 bg-white border-2 border-red-400 rounded-full flex items-center justify-center cursor-crosshair hover:bg-red-50 transition-colors z-30"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setConnectingFrom({ nodeId: node.id, handle: "false" });
                  }}
                  title="Não (Falso)"
                >
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
