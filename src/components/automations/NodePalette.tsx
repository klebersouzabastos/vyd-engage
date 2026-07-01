import {
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
  Bell,
  ArrowRightLeft,
  BarChart3,
} from 'lucide-react';
import { TRIGGER_TYPES, ACTION_TYPES } from '../../utils/automationFlowConverter';
import type { ReactNode } from 'react';

interface NodePaletteProps {
  onAddNode: (type: 'trigger' | 'action' | 'condition', nodeType: string) => void;
  hasTrigger: boolean;
}

const TRIGGER_ICONS: Record<string, ReactNode> = {
  lead_created: <UserPlus size={16} />,
  lead_updated: <RefreshCw size={16} />,
  status_changed: <ArrowRightLeft size={16} />,
  tag_added: <Tag size={16} />,
  deal_created: <BarChart3 size={16} />,
  deal_stage_changed: <ArrowRightLeft size={16} />,
  task_completed: <CheckSquare size={16} />,
  form_submitted: <FileText size={16} />,
};

const ACTION_ICONS: Record<string, ReactNode> = {
  send_email: <Mail size={16} />,
  create_task: <CheckSquare size={16} />,
  update_field: <RefreshCw size={16} />,
  add_tag: <Tag size={16} />,
  remove_tag: <Tag size={16} />,
  send_webhook: <Globe size={16} />,
  wait_delay: <Timer size={16} />,
  send_whatsapp: <MessageSquare size={16} />,
};

export function NodePalette({ onAddNode, hasTrigger }: NodePaletteProps) {
  return (
    <div className="w-64 bg-card border-r border-gray-200 overflow-y-auto flex-shrink-0">
      <div className="p-4">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Gatilhos
        </h3>
        <div className="space-y-1.5 mb-6">
          {TRIGGER_TYPES.map((trigger) => (
            <button
              key={trigger.value}
              onClick={() => onAddNode('trigger', trigger.value)}
              disabled={hasTrigger}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${
                hasTrigger
                  ? 'opacity-40 cursor-not-allowed bg-gray-50 text-gray-400'
                  : 'hover:bg-green-50 text-gray-700 hover:text-green-700 border border-transparent hover:border-green-200'
              }`}
            >
              <div className="w-7 h-7 rounded-md bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0">
                {TRIGGER_ICONS[trigger.value] || <Zap size={16} />}
              </div>
              <span className="truncate">{trigger.label}</span>
            </button>
          ))}
        </div>

        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Ações</h3>
        <div className="space-y-1.5 mb-6">
          {ACTION_TYPES.map((action) => (
            <button
              key={action.value}
              onClick={() => onAddNode('action', action.value)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition-colors hover:bg-blue-50 text-gray-700 hover:text-blue-700 border border-transparent hover:border-blue-200"
            >
              <div className="w-7 h-7 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                {ACTION_ICONS[action.value] || <Zap size={16} />}
              </div>
              <span className="truncate">{action.label}</span>
            </button>
          ))}
        </div>

        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Lógica
        </h3>
        <div className="space-y-1.5">
          <button
            onClick={() => onAddNode('condition', 'condition')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition-colors hover:bg-amber-50 text-gray-700 hover:text-amber-700 border border-transparent hover:border-amber-200"
          >
            <div className="w-7 h-7 rounded-md bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
              <GitBranch size={16} />
            </div>
            <span>Condição (Se/Senão)</span>
          </button>
        </div>

        {hasTrigger && (
          <p className="text-xs text-gray-400 mt-4 px-1">
            Apenas 1 gatilho por automação. Remova o atual para trocar.
          </p>
        )}
      </div>
    </div>
  );
}
