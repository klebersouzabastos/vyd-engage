import {
  Mail,
  MessageSquare,
  CheckSquare,
  Tag,
  Globe,
  Timer,
  RefreshCw,
  Zap,
  X,
} from "lucide-react";
import { ACTION_TYPES } from "../../utils/automationFlowConverter";
import type { FlowNode } from "../../utils/automationFlowConverter";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import type { ReactNode } from "react";

interface ActionNodeProps {
  node: FlowNode;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (config: Record<string, any>) => void;
  onDelete: () => void;
  showConfig: boolean;
  onToggleConfig: () => void;
}

const ICONS: Record<string, ReactNode> = {
  send_email: <Mail size={18} />,
  create_task: <CheckSquare size={18} />,
  update_field: <RefreshCw size={18} />,
  add_tag: <Tag size={18} />,
  remove_tag: <Tag size={18} />,
  send_webhook: <Globe size={18} />,
  wait_delay: <Timer size={18} />,
  send_whatsapp: <MessageSquare size={18} />,
};

function ActionConfigPanel({
  node,
  onUpdate,
  onClose,
}: {
  node: FlowNode;
  onUpdate: (config: Record<string, any>) => void;
  onClose: () => void;
}) {
  const nodeType = node.data.nodeType;
  const config = node.data.config;

  return (
    <div className="absolute left-full top-0 ml-4 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-30 max-h-[500px] overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 sticky top-0 bg-white">
        <h4 className="font-medium text-sm text-gray-900">Configurar Ação</h4>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X size={14} className="text-gray-500" />
        </button>
      </div>
      <div className="p-4 space-y-3">
        {/* Action type selector */}
        <div>
          <Label className="text-xs">Tipo da Ação</Label>
          <select
            value={nodeType}
            onChange={(e) => {
              const newType = e.target.value;
              const label = ACTION_TYPES.find((a) => a.value === newType)?.label || newType;
              onUpdate({ ...config, _nodeType: newType, _label: label });
            }}
            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
          >
            {ACTION_TYPES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>

        {/* Send Email */}
        {nodeType === "send_email" && (
          <>
            <div>
              <Label className="text-xs">Assunto</Label>
              <Input
                value={config.subject || ""}
                onChange={(e) => onUpdate({ ...config, subject: e.target.value })}
                placeholder="Assunto do e-mail"
                className="mt-1 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Corpo do E-mail</Label>
              <Textarea
                value={config.message || ""}
                onChange={(e) => onUpdate({ ...config, message: e.target.value })}
                placeholder="Conteúdo do e-mail. Use {{nome}}, {{email}}..."
                className="mt-1 text-sm"
                rows={4}
              />
            </div>
          </>
        )}

        {/* Send WhatsApp */}
        {nodeType === "send_whatsapp" && (
          <div>
            <Label className="text-xs">Mensagem</Label>
            <Textarea
              value={config.message || ""}
              onChange={(e) => onUpdate({ ...config, message: e.target.value })}
              placeholder="Mensagem WhatsApp. Use {{nome}}, {{email}}..."
              className="mt-1 text-sm"
              rows={4}
            />
          </div>
        )}

        {/* Create Task */}
        {nodeType === "create_task" && (
          <>
            <div>
              <Label className="text-xs">Título da Tarefa</Label>
              <Input
                value={config.title || ""}
                onChange={(e) => onUpdate({ ...config, title: e.target.value })}
                placeholder="Ex: Follow-up com {{nome}}"
                className="mt-1 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">ID do Responsável (opcional)</Label>
              <Input
                value={config.assigneeId || ""}
                onChange={(e) => onUpdate({ ...config, assigneeId: e.target.value })}
                placeholder="ID do usuário"
                className="mt-1 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Prazo (dias a partir de agora)</Label>
              <Input
                type="number"
                min="1"
                value={config.dueDateOffset || ""}
                onChange={(e) =>
                  onUpdate({ ...config, dueDateOffset: parseInt(e.target.value) || undefined })
                }
                placeholder="Ex: 3"
                className="mt-1 text-sm"
              />
            </div>
          </>
        )}

        {/* Update Field */}
        {nodeType === "update_field" && (
          <>
            <div>
              <Label className="text-xs">Campo</Label>
              <select
                value={config.field || "status"}
                onChange={(e) => onUpdate({ ...config, field: e.target.value })}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
              >
                <option value="status">Status</option>
                <option value="assignedTo">Responsável</option>
                <option value="score">Score</option>
                <option value="source">Fonte</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Novo Valor</Label>
              {config.field === "status" ? (
                <select
                  value={config.value || ""}
                  onChange={(e) => onUpdate({ ...config, value: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
                >
                  <option value="">Selecione...</option>
                  <option value="NEW">Novo</option>
                  <option value="CONTACTED">Contatado</option>
                  <option value="QUALIFIED">Qualificado</option>
                  <option value="PROPOSAL">Proposta</option>
                  <option value="NEGOTIATION">Negociação</option>
                  <option value="WON">Ganho</option>
                  <option value="LOST">Perdido</option>
                </select>
              ) : (
                <Input
                  value={config.value || ""}
                  onChange={(e) => onUpdate({ ...config, value: e.target.value })}
                  placeholder="Novo valor"
                  className="mt-1 text-sm"
                />
              )}
            </div>
          </>
        )}

        {/* Add/Remove Tag */}
        {(nodeType === "add_tag" || nodeType === "remove_tag") && (
          <div>
            <Label className="text-xs">Nome da Tag</Label>
            <Input
              value={config.tagName || ""}
              onChange={(e) => onUpdate({ ...config, tagName: e.target.value })}
              placeholder="Ex: lead-quente"
              className="mt-1 text-sm"
            />
          </div>
        )}

        {/* Send Webhook */}
        {nodeType === "send_webhook" && (
          <>
            <div>
              <Label className="text-xs">URL do Webhook</Label>
              <Input
                value={config.url || ""}
                onChange={(e) => onUpdate({ ...config, url: e.target.value })}
                placeholder="https://..."
                className="mt-1 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Método HTTP</Label>
              <select
                value={config.method || "POST"}
                onChange={(e) => onUpdate({ ...config, method: e.target.value })}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
              >
                <option value="POST">POST</option>
                <option value="GET">GET</option>
                <option value="PUT">PUT</option>
              </select>
            </div>
          </>
        )}

        {/* Wait Delay */}
        {nodeType === "wait_delay" && (
          <div>
            <Label className="text-xs">Tempo de Espera</Label>
            <div className="flex gap-2 mt-1">
              <Input
                type="number"
                min="1"
                value={config.duration || 1}
                onChange={(e) =>
                  onUpdate({ ...config, duration: parseInt(e.target.value) || 1 })
                }
                className="flex-1 text-sm"
              />
              <select
                value={config.unit || "d"}
                onChange={(e) => onUpdate({ ...config, unit: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
              >
                <option value="n">Minutos</option>
                <option value="h">Horas</option>
                <option value="d">Dias</option>
                <option value="w">Semanas</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ActionNode({
  node,
  selected,
  onSelect,
  onUpdate,
  onDelete,
  showConfig,
  onToggleConfig,
}: ActionNodeProps) {
  const icon = ICONS[node.data.nodeType] || <Zap size={18} />;
  const label = node.data.label || "Ação";

  // Build a brief summary
  const configSummary = (() => {
    const c = node.data.config;
    const nt = node.data.nodeType;
    if (nt === "send_email" && c.subject) return `Assunto: ${c.subject}`;
    if (nt === "send_whatsapp" && c.message) return c.message.slice(0, 40) + (c.message.length > 40 ? "..." : "");
    if (nt === "create_task" && c.title) return c.title;
    if (nt === "update_field") return `${c.field || "status"} → ${c.value || "..."}`;
    if ((nt === "add_tag" || nt === "remove_tag") && c.tagName) return c.tagName;
    if (nt === "send_webhook" && c.url) return c.url.slice(0, 30) + "...";
    if (nt === "wait_delay") {
      const dur = c.duration || 1;
      const unitMap: Record<string, string> = { n: "min", h: "h", d: "dias", w: "sem" };
      return `${dur} ${unitMap[c.unit || "d"] || c.unit || "dias"}`;
    }
    return "";
  })();

  return (
    <div className="relative group">
      <div
        className={`w-72 rounded-lg border-2 cursor-pointer transition-all shadow-sm ${
          selected
            ? "border-blue-500 shadow-blue-100 shadow-md"
            : "border-blue-300 hover:border-blue-400 hover:shadow-md"
        }`}
        onClick={onSelect}
        onDoubleClick={onToggleConfig}
      >
        <div className="bg-blue-50 border-b border-blue-200 rounded-t-lg px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-blue-500 text-white flex items-center justify-center">
              {icon}
            </div>
            <span className="text-sm font-semibold text-blue-800">Ação</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-blue-200 rounded"
          >
            <X size={14} className="text-blue-600" />
          </button>
        </div>
        <div className="bg-white rounded-b-lg px-4 py-3">
          <p className="text-sm font-medium text-gray-900">{label}</p>
          {configSummary && (
            <p className="text-xs text-gray-500 mt-1 truncate">{configSummary}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">Clique duplo para configurar</p>
        </div>
      </div>

      {showConfig && (
        <ActionConfigPanel node={node} onUpdate={onUpdate} onClose={onToggleConfig} />
      )}
    </div>
  );
}
