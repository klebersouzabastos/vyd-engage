import { useCallback, useState } from 'react';
import {
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
} from '@xyflow/react';
import { FlowCanvas } from './FlowCanvas';
import { layoutFlow } from './flowLayout';
import {
  generateNodeId,
  generateEdgeId,
  TRIGGER_TYPES,
  ACTION_TYPES,
  flowToAutomation,
} from '../../utils/automationFlowConverter';
import type { FlowNode, FlowData } from '../../utils/automationFlowConverter';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import {
  ArrowLeft,
  Save,
  Loader2,
  Zap,
  Mail,
  MessageSquare,
  CheckSquare,
  Tag,
  Globe,
  Timer,
  GitBranch,
  RefreshCw,
  UserPlus,
  FileText,
  ArrowRightLeft,
  BarChart3,
  type LucideIcon,
} from 'lucide-react';

// Ícones dos gatilhos/ações (migrados da antiga NodePalette) como LucideIcon.
const TRIGGER_ICON: Record<string, LucideIcon> = {
  lead_created: UserPlus,
  lead_updated: RefreshCw,
  status_changed: ArrowRightLeft,
  tag_added: Tag,
  deal_created: BarChart3,
  deal_stage_changed: ArrowRightLeft,
  task_completed: CheckSquare,
  form_submitted: FileText,
};
const ACTION_ICON: Record<string, LucideIcon> = {
  send_email: Mail,
  create_task: CheckSquare,
  update_field: RefreshCw,
  add_tag: Tag,
  remove_tag: Tag,
  send_webhook: Globe,
  wait_delay: Timer,
  send_whatsapp: MessageSquare,
};

/** Aplica rótulo Sim/Não e cor às arestas que saem dos ramos da condição. */
function decorateEdge<T extends Edge | Connection>(edge: T): T {
  if (edge.sourceHandle === 'true') {
    return { ...edge, label: 'Sim', style: { stroke: 'var(--vyd-success)' } } as T;
  }
  if (edge.sourceHandle === 'false') {
    return { ...edge, label: 'Não', style: { stroke: 'var(--vyd-danger)' } } as T;
  }
  return edge;
}

interface CreateMenuState {
  flowPosition: { x: number; y: number };
  screen: { x: number; y: number };
  sourceNodeId: string;
  sourceHandleId: string | null;
}

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
  const [nodes, setNodes, onNodesChange] = useNodesState(
    initialFlowData.nodes as unknown as Node[]
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    initialFlowData.edges as unknown as Edge[]
  );

  const hasTrigger = nodes.some((n) => n.type === 'trigger');

  // Menu do connect-to-create (aberto ao soltar uma conexão em área vazia).
  const [createMenu, setCreateMenu] = useState<CreateMenuState | null>(null);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(decorateEdge(connection), eds)),
    [setEdges]
  );

  const handleConnectToCreate = useCallback(
    (params: CreateMenuState) => {
      const sh = params.sourceHandleId;
      // Ramo de condição (true/false) já conectado: não abre menu (cap 1:1).
      if (
        (sh === 'true' || sh === 'false') &&
        edges.some((e) => e.source === params.sourceNodeId && e.sourceHandle === sh)
      ) {
        return;
      }
      setCreateMenu(params);
    },
    [edges]
  );

  const createConnectedNode = useCallback(
    (type: 'action' | 'condition', nodeType: string) => {
      if (!createMenu) return;
      const id = generateNodeId();
      const label =
        type === 'condition'
          ? 'Condição'
          : ACTION_TYPES.find((a) => a.value === nodeType)?.label || nodeType;

      const newNode: Node = {
        id,
        type,
        // Centraliza horizontalmente o card (w-72 ≈ 288px) sob o cursor.
        position: { x: createMenu.flowPosition.x - 144, y: createMenu.flowPosition.y },
        data: {
          nodeType,
          label,
          config:
            type === 'condition'
              ? { field: 'status', operator: 'equals', value: '', logic: 'AND' }
              : {},
        },
      };

      const sh = createMenu.sourceHandleId;
      const edge = decorateEdge({
        id: `${generateEdgeId(createMenu.sourceNodeId, id)}${sh ? `_${sh}` : ''}`,
        source: createMenu.sourceNodeId,
        target: id,
        sourceHandle: sh ?? undefined,
      } as Edge);

      setNodes((nds) => [...nds, newNode]);
      setEdges((eds) => addEdge(edge, eds));
      setCreateMenu(null);
    },
    [createMenu, setNodes, setEdges]
  );

  const handleAddNode = useCallback(
    (type: 'trigger' | 'action' | 'condition', nodeType: string) => {
      const maxY = nodes.length > 0 ? Math.max(...nodes.map((n) => n.position.y)) : -80;
      const centerX = 300;
      const nodeId = generateNodeId();

      let label = nodeType;
      if (type === 'trigger') {
        label = TRIGGER_TYPES.find((t) => t.value === nodeType)?.label || nodeType;
      } else if (type === 'action') {
        label = ACTION_TYPES.find((a) => a.value === nodeType)?.label || nodeType;
      } else if (type === 'condition') {
        label = 'Condição';
      }

      const newNode: Node = {
        id: nodeId,
        type,
        position: { x: centerX, y: maxY + 140 },
        data: {
          nodeType,
          label,
          config:
            type === 'condition'
              ? { field: 'status', operator: 'equals', value: '', logic: 'AND' }
              : {},
        },
      };

      setNodes((nds) => [...nds, newNode]);

      // Auto-connect from the previous node when sensible
      if (nodes.length > 0) {
        const lastNode = nodes[nodes.length - 1];
        const lastNodeEdges = edges.filter((e) => e.source === lastNode.id);
        if (lastNode.type !== 'condition' && lastNodeEdges.length === 0) {
          setEdges((eds) => [
            ...eds,
            { id: generateEdgeId(lastNode.id, nodeId), source: lastNode.id, target: nodeId },
          ]);
        } else if (lastNode.type === 'condition') {
          const trueEdge = lastNodeEdges.find((e) => e.sourceHandle === 'true');
          if (!trueEdge) {
            setEdges((eds) => [
              ...eds,
              {
                id: generateEdgeId(lastNode.id, nodeId),
                source: lastNode.id,
                target: nodeId,
                sourceHandle: 'true',
              },
            ]);
          }
        }
      }
    },
    [nodes, edges, setNodes, setEdges]
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    },
    [setNodes, setEdges]
  );

  const handleUpdateNodeConfig = useCallback(
    (nodeId: string, config: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n;
          // _nodeType / _label are special keys used when a node changes its type
          const data = n.data as {
            nodeType: string;
            label: string;
            config: Record<string, unknown>;
          };
          const newNodeType = (config._nodeType as string) || data.nodeType;
          const newLabel = (config._label as string) || data.label;
          const cleanConfig = { ...config };
          delete cleanConfig._nodeType;
          delete cleanConfig._label;
          return {
            ...n,
            data: { ...data, nodeType: newNodeType, label: newLabel, config: cleanConfig },
          };
        })
      );
    },
    [setNodes]
  );

  const handleAutoLayout = useCallback(() => {
    setNodes((nds) => layoutFlow(nds, edges));
  }, [edges, setNodes]);

  const handleSave = () => {
    if (!name.trim()) return;
    const flowData: FlowData = {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: (n.type || 'action') as FlowNode['type'],
        position: n.position,
        data: n.data as unknown as FlowNode['data'],
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? undefined,
        label: typeof e.label === 'string' ? e.label : undefined,
      })),
    };
    const { trigger, steps, conditions } = flowToAutomation(flowData);
    onSave({ name, description, isActive, flowData, trigger, steps, conditions });
  };

  // Paleta de nós (ex-NodePalette): Gatilhos / Ações / Lógica. Renderizada como
  // painel lateral DENTRO do canvas do builder (a faixa do shell virou navegação).
  const paletteSections: {
    label: string;
    items: {
      icon: LucideIcon;
      label: string;
      onClick: () => void;
      disabled?: boolean;
      title?: string;
    }[];
  }[] = [
    {
      label: 'Gatilhos',
      items: TRIGGER_TYPES.map((t) => ({
        icon: TRIGGER_ICON[t.value] ?? Zap,
        label: t.label,
        onClick: () => handleAddNode('trigger', t.value),
        disabled: hasTrigger,
        title: hasTrigger ? 'Apenas 1 gatilho por automação. Remova o atual para trocar.' : t.label,
      })),
    },
    {
      label: 'Ações',
      items: ACTION_TYPES.map((a) => ({
        icon: ACTION_ICON[a.value] ?? Zap,
        label: a.label,
        onClick: () => handleAddNode('action', a.value),
      })),
    },
    {
      label: 'Lógica',
      items: [
        {
          icon: GitBranch,
          label: 'Condição',
          onClick: () => handleAddNode('condition', 'condition'),
        },
      ],
    },
  ];

  return (
    <>
      {/* Editor de automação: barra (Voltar/Nome/Ativo/Salvar) + paleta de nós
          (Gatilhos/Ações/Lógica) + canvas, tudo dentro do .vyd-canvas do shell. */}
      <div className="absolute inset-0 flex flex-col">
        <div className="flex items-center gap-2 border-b border-gray-200 bg-card px-3 py-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
            <ArrowLeft size={16} />
            Voltar
          </Button>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da automação"
            className="w-52 h-8 text-sm"
          />
          <label
            className="flex items-center gap-2 text-xs whitespace-nowrap"
            style={{ color: 'var(--vyd-text-secondary)' }}
          >
            {isActive ? 'Ativo' : 'Inativo'}
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </label>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="gap-2 ml-auto"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Salvar
          </Button>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Paleta de nós (ex-NodePalette) */}
          <aside className="w-60 flex-shrink-0 overflow-y-auto border-r border-gray-200 bg-card p-3">
            {paletteSections.map((section) => (
              <div key={section.label} className="mb-4">
                <div className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  {section.label}
                </div>
                <div className="flex flex-col gap-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={item.onClick}
                        disabled={item.disabled}
                        title={item.title || item.label}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Icon size={16} className="flex-shrink-0 text-gray-500" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </aside>

          {/* Canvas */}
          <div className="relative flex-1">
            <FlowCanvas
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onConnectToCreate={handleConnectToCreate}
              onUpdateNodeConfig={handleUpdateNodeConfig}
              onDeleteNode={handleDeleteNode}
              onAutoLayout={handleAutoLayout}
            />
          </div>
        </div>
      </div>

      {/* Connect-to-create: menu de tipos ao soltar uma conexão no vazio */}
      {createMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            role="button"
            tabIndex={0}
            aria-label="Fechar menu"
            onClick={() => setCreateMenu(null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                if (e.key === ' ') e.preventDefault();
                setCreateMenu(null);
              }
            }}
          />
          <div
            className="fixed z-50 w-56 max-h-80 overflow-y-auto bg-card rounded-lg shadow-xl border border-gray-200 py-1"
            style={{ left: createMenu.screen.x, top: createMenu.screen.y }}
          >
            <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Adicionar ação
            </div>
            {ACTION_TYPES.map((a) => (
              <button
                key={a.value}
                onClick={() => createConnectedNode('action', a.value)}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700"
              >
                {a.label}
              </button>
            ))}
            <div className="px-3 py-1.5 mt-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 border-t border-gray-100">
              Lógica
            </div>
            <button
              onClick={() => createConnectedNode('condition', 'condition')}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-700"
            >
              Condição (Se/Senão)
            </button>
          </div>
        </>
      )}
    </>
  );
}
