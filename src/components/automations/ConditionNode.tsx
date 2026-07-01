import { GitBranch, X } from 'lucide-react';
import { CONDITION_OPERATORS } from '../../utils/automationFlowConverter';
import type { FlowNode } from '../../utils/automationFlowConverter';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface ConditionNodeProps {
  node: FlowNode;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (config: Record<string, any>) => void;
  onDelete: () => void;
  showConfig: boolean;
  onToggleConfig: () => void;
}

function ConditionConfigPanel({
  node,
  onUpdate,
  onClose,
}: {
  node: FlowNode;
  onUpdate: (config: Record<string, any>) => void;
  onClose: () => void;
}) {
  const config = node.data.config;

  return (
    <div className="absolute left-full top-0 ml-4 w-80 bg-card rounded-lg shadow-lg border border-gray-200 z-30">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h4 className="font-medium text-sm text-gray-900">Configurar Condição</h4>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X size={14} className="text-gray-500" />
        </button>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <Label className="text-xs">Campo</Label>
          <select
            value={config.field || 'status'}
            onChange={(e) => onUpdate({ ...config, field: e.target.value })}
            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md bg-card text-sm"
          >
            <option value="status">Status</option>
            <option value="source">Fonte</option>
            <option value="score">Score</option>
            <option value="email">Email</option>
            <option value="name">Nome</option>
            <option value="company">Empresa</option>
            <option value="phone">Telefone</option>
            <option value="tags">Tags</option>
          </select>
        </div>
        <div>
          <Label className="text-xs">Operador</Label>
          <select
            value={config.operator || 'equals'}
            onChange={(e) => onUpdate({ ...config, operator: e.target.value })}
            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md bg-card text-sm"
          >
            {CONDITION_OPERATORS.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
        </div>
        {config.operator !== 'is_empty' && config.operator !== 'is_not_empty' && (
          <div>
            <Label className="text-xs">Valor</Label>
            <Input
              value={config.value || ''}
              onChange={(e) => onUpdate({ ...config, value: e.target.value })}
              placeholder="Valor para comparar"
              className="mt-1 text-sm"
            />
          </div>
        )}
        <div>
          <Label className="text-xs">Lógica (múltiplas condições)</Label>
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => onUpdate({ ...config, logic: 'AND' })}
              className={`flex-1 py-1.5 rounded text-sm font-medium transition-colors ${
                (config.logic || 'AND') === 'AND'
                  ? 'bg-amber-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              E (AND)
            </button>
            <button
              onClick={() => onUpdate({ ...config, logic: 'OR' })}
              className={`flex-1 py-1.5 rounded text-sm font-medium transition-colors ${
                config.logic === 'OR'
                  ? 'bg-amber-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              OU (OR)
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-gray-200">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="w-3 h-3 rounded-full bg-green-400" />
            <span>Verdadeiro: segue pela saída superior</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <span>Falso: segue pela saída inferior</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ConditionNode({
  node,
  selected,
  onSelect,
  onUpdate,
  onDelete,
  showConfig,
  onToggleConfig,
}: ConditionNodeProps) {
  const config = node.data.config;
  const field = config.field || 'status';
  const op =
    CONDITION_OPERATORS.find((o) => o.value === (config.operator || 'equals'))?.label ||
    config.operator;
  const value = config.value || '...';

  return (
    <div className="relative group">
      <div
        className={`w-72 rounded-lg border-2 cursor-pointer transition-all shadow-sm ${
          selected
            ? 'border-amber-500 shadow-amber-100 shadow-md'
            : 'border-amber-300 hover:border-amber-400 hover:shadow-md'
        }`}
        onClick={onSelect}
        onDoubleClick={onToggleConfig}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            if (e.key === ' ') e.preventDefault();
            onSelect();
          }
        }}
      >
        <div className="bg-amber-50 border-b border-amber-200 rounded-t-lg px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-amber-500 text-white flex items-center justify-center">
              <GitBranch size={18} />
            </div>
            <span className="text-sm font-semibold text-amber-800">Condição</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-amber-200 rounded"
          >
            <X size={14} className="text-amber-600" />
          </button>
        </div>
        <div className="bg-card rounded-b-lg px-4 py-3">
          <p className="text-sm font-medium text-gray-900">
            Se {field} {op} {value}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
              <span className="text-green-700">Sim</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <span className="text-red-700">Não</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-1">Clique duplo para configurar</p>
        </div>
      </div>

      {showConfig && (
        <ConditionConfigPanel node={node} onUpdate={onUpdate} onClose={onToggleConfig} />
      )}
    </div>
  );
}
