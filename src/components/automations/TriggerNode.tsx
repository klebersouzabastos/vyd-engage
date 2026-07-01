import {
  Zap,
  UserPlus,
  RefreshCw,
  ArrowRightLeft,
  Tag,
  BarChart3,
  CheckSquare,
  FileText,
  X,
} from 'lucide-react';
import { TRIGGER_TYPES } from '../../utils/automationFlowConverter';
import type { FlowNode } from '../../utils/automationFlowConverter';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import type { ReactNode } from 'react';

interface TriggerNodeProps {
  node: FlowNode;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (config: Record<string, any>) => void;
  onDelete: () => void;
  showConfig: boolean;
  onToggleConfig: () => void;
}

const ICONS: Record<string, ReactNode> = {
  lead_created: <UserPlus size={18} />,
  lead_updated: <RefreshCw size={18} />,
  status_changed: <ArrowRightLeft size={18} />,
  tag_added: <Tag size={18} />,
  deal_created: <BarChart3 size={18} />,
  deal_stage_changed: <ArrowRightLeft size={18} />,
  task_completed: <CheckSquare size={18} />,
  form_submitted: <FileText size={18} />,
};

function TriggerConfigPanel({
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
    <div className="absolute left-full top-0 ml-4 w-80 bg-card rounded-lg shadow-lg border border-gray-200 z-30">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h4 className="font-medium text-sm text-gray-900">Configurar Gatilho</h4>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X size={14} className="text-gray-500" />
        </button>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <Label className="text-xs">Tipo do Gatilho</Label>
          <select
            value={nodeType}
            onChange={(e) => {
              const newType = e.target.value;
              const label = TRIGGER_TYPES.find((t) => t.value === newType)?.label || newType;
              onUpdate({ ...config, _nodeType: newType, _label: label });
            }}
            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md bg-card text-sm"
          >
            {TRIGGER_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {nodeType === 'status_changed' && (
          <div>
            <Label className="text-xs">Status específico</Label>
            <select
              value={config.status || ''}
              onChange={(e) => onUpdate({ ...config, status: e.target.value || undefined })}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md bg-card text-sm"
            >
              <option value="">Qualquer mudança</option>
              <option value="NEW">Novo</option>
              <option value="CONTACTED">Contatado</option>
              <option value="QUALIFIED">Qualificado</option>
              <option value="PROPOSAL">Proposta</option>
              <option value="NEGOTIATION">Negociação</option>
              <option value="WON">Ganho</option>
              <option value="LOST">Perdido</option>
            </select>
          </div>
        )}

        {nodeType === 'lead_created' && (
          <div>
            <Label className="text-xs">Fonte do lead</Label>
            <select
              value={config.source || ''}
              onChange={(e) => onUpdate({ ...config, source: e.target.value || undefined })}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md bg-card text-sm"
            >
              <option value="">Qualquer fonte</option>
              <option value="WEBSITE">Website</option>
              <option value="REFERRAL">Indicação</option>
              <option value="SOCIAL_MEDIA">Redes Sociais</option>
              <option value="PAID_ADS">Anúncios Pagos</option>
              <option value="OTHER">Outra</option>
            </select>
          </div>
        )}

        {nodeType === 'tag_added' && (
          <div>
            <Label className="text-xs">Tag específica</Label>
            <Input
              value={config.tagId || ''}
              onChange={(e) => onUpdate({ ...config, tagId: e.target.value || undefined })}
              placeholder="ID da tag (vazio = qualquer)"
              className="mt-1 text-sm"
            />
          </div>
        )}

        {nodeType === 'deal_stage_changed' && (
          <div>
            <Label className="text-xs">Estágio específico</Label>
            <Input
              value={config.stageName || ''}
              onChange={(e) => onUpdate({ ...config, stageName: e.target.value || undefined })}
              placeholder="Nome do estágio (vazio = qualquer)"
              className="mt-1 text-sm"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function TriggerNode({
  node,
  selected,
  onSelect,
  onUpdate,
  onDelete,
  showConfig,
  onToggleConfig,
}: TriggerNodeProps) {
  const icon = ICONS[node.data.nodeType] || <Zap size={18} />;
  const label = node.data.label || 'Gatilho';

  // Build a brief summary of config
  const configSummary = (() => {
    const c = node.data.config;
    if (node.data.nodeType === 'status_changed' && c.status) return `→ ${c.status}`;
    if (node.data.nodeType === 'lead_created' && c.source) return `Fonte: ${c.source}`;
    if (node.data.nodeType === 'tag_added' && c.tagId) return `Tag: ${c.tagId}`;
    return '';
  })();

  return (
    <div className="relative group">
      <div
        role="button"
        tabIndex={0}
        className={`w-72 rounded-lg border-2 cursor-pointer transition-all shadow-sm ${
          selected
            ? 'border-green-500 shadow-green-100 shadow-md'
            : 'border-green-300 hover:border-green-400 hover:shadow-md'
        }`}
        onClick={onSelect}
        onDoubleClick={onToggleConfig}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            if (e.key === ' ') e.preventDefault();
            onSelect();
          }
        }}
      >
        <div className="bg-green-50 border-b border-green-200 rounded-t-lg px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-green-500 text-white flex items-center justify-center">
              {icon}
            </div>
            <span className="text-sm font-semibold text-green-800">Gatilho</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-green-200 rounded"
          >
            <X size={14} className="text-green-600" />
          </button>
        </div>
        <div className="bg-card rounded-b-lg px-4 py-3">
          <p className="text-sm font-medium text-gray-900">{label}</p>
          {configSummary && <p className="text-xs text-gray-500 mt-1">{configSummary}</p>}
          <p className="text-xs text-gray-400 mt-1">Clique duplo para configurar</p>
        </div>
      </div>

      {showConfig && (
        <TriggerConfigPanel node={node} onUpdate={onUpdate} onClose={onToggleConfig} />
      )}
    </div>
  );
}
