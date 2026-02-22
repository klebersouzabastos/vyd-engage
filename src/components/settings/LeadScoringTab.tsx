import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../services/api/client';
import { Button } from '../ui/button';
import { Trash2, Plus, RefreshCw, Pencil, X, Check } from 'lucide-react';

interface ScoreRule {
  id: string;
  name: string;
  eventType: string;
  points: number;
  description: string | null;
  active: boolean;
  conditions: Record<string, any> | null;
  createdAt: string;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  LEAD_CREATED: 'Lead criado',
  STATUS_CHANGED: 'Status alterado',
  TAG_ADDED: 'Tag adicionada',
  INTERACTION_CREATED: 'Interação registrada',
  EMAIL_OPENED: 'Email aberto',
  EMAIL_CLICKED: 'Link clicado no email',
  WHATSAPP_REPLIED: 'Resposta no WhatsApp',
  FORM_SUBMITTED: 'Formulário enviado',
};

const EVENT_TYPES = Object.keys(EVENT_TYPE_LABELS);

export function LeadScoringTab() {
  const [rules, setRules] = useState<ScoreRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Form state for create/edit
  const [formName, setFormName] = useState('');
  const [formEventType, setFormEventType] = useState('LEAD_CREATED');
  const [formPoints, setFormPoints] = useState(10);
  const [formDescription, setFormDescription] = useState('');

  const loadRules = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.getDefaultScoringRules();
      const data = res.data || res || [];
      setRules(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load scoring rules:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const resetForm = () => {
    setFormName('');
    setFormEventType('LEAD_CREATED');
    setFormPoints(10);
    setFormDescription('');
  };

  const startEdit = (rule: ScoreRule) => {
    setEditingId(rule.id);
    setFormName(rule.name);
    setFormEventType(rule.eventType);
    setFormPoints(rule.points);
    setFormDescription(rule.description || '');
    setShowCreate(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setShowCreate(false);
    resetForm();
  };

  const handleCreate = async () => {
    if (!formName.trim()) return;
    try {
      setSaving(true);
      const res = await apiClient.createScoringRule({
        name: formName,
        eventType: formEventType,
        points: formPoints,
        description: formDescription || undefined,
      });
      const newRule = res.data || res;
      setRules(prev => [...prev, newRule]);
      setShowCreate(false);
      resetForm();
    } catch (err: any) {
      console.error('Failed to create rule:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingId || !formName.trim()) return;
    try {
      setSaving(true);
      const res = await apiClient.updateScoringRule(editingId, {
        name: formName,
        eventType: formEventType,
        points: formPoints,
        description: formDescription || null,
      });
      const updated = res.data || res;
      setRules(prev => prev.map(r => r.id === editingId ? updated : r));
      setEditingId(null);
      resetForm();
    } catch (err: any) {
      console.error('Failed to update rule:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (rule: ScoreRule) => {
    try {
      const res = await apiClient.updateScoringRule(rule.id, { active: !rule.active });
      const updated = res.data || res;
      setRules(prev => prev.map(r => r.id === rule.id ? updated : r));
    } catch (err) {
      console.error('Failed to toggle rule:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.deleteScoringRule(id);
      setRules(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error('Failed to delete rule:', err);
    }
  };

  const handleRecalculate = async () => {
    try {
      setRecalculating(true);
      await apiClient.recalculateAllScores();
    } catch (err) {
      console.error('Failed to recalculate:', err);
    } finally {
      setRecalculating(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-48" />
          <div className="h-4 bg-gray-200 rounded w-96" />
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-100 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Lead Scoring</h3>
        <p className="text-sm text-gray-500">
          Configure as regras de pontuação para classificar seus leads automaticamente.
          Cada evento soma pontos ao score do lead.
        </p>
      </div>

      {/* Score ranges legend */}
      <div className="flex gap-4 text-xs">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-red-500" /> Quente (80+)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-orange-500" /> Morno (50-79)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-blue-500" /> Frio (25-49)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-gray-400" /> Muito Frio (0-24)
        </span>
      </div>

      {/* Rules list */}
      <div className="space-y-2">
        {rules.map(rule => (
          <div
            key={rule.id}
            className={`border rounded-lg p-4 ${rule.active ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}
          >
            {editingId === rule.id ? (
              /* Edit form inline */
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Nome</label>
                    <input
                      type="text"
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Evento</label>
                    <select
                      value={formEventType}
                      onChange={e => setFormEventType(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                    >
                      {EVENT_TYPES.map(et => (
                        <option key={et} value={et}>{EVENT_TYPE_LABELS[et]}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Pontos</label>
                    <input
                      type="number"
                      value={formPoints}
                      onChange={e => setFormPoints(parseInt(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Descrição</label>
                    <input
                      type="text"
                      value={formDescription}
                      onChange={e => setFormDescription(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={cancelEdit}>
                    <X size={14} className="mr-1" /> Cancelar
                  </Button>
                  <Button size="sm" onClick={handleUpdate} disabled={saving}>
                    <Check size={14} className="mr-1" /> Salvar
                  </Button>
                </div>
              </div>
            ) : (
              /* Display row */
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-900">{rule.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {EVENT_TYPE_LABELS[rule.eventType] || rule.eventType}
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${rule.points >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {rule.points > 0 ? '+' : ''}{rule.points} pts
                    </span>
                  </div>
                  {rule.description && (
                    <p className="text-xs text-gray-500 mt-1">{rule.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggle(rule)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${rule.active ? 'bg-primary' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${rule.active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                  <Button variant="ghost" size="sm" onClick={() => startEdit(rule)}>
                    <Pencil size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(rule.id)} className="text-red-500 hover:text-red-700">
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="border border-primary/30 rounded-lg p-4 bg-primary/5 space-y-3">
          <h4 className="text-sm font-medium text-gray-900">Nova regra de scoring</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Nome</label>
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="Ex: Email aberto"
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Evento</label>
              <select
                value={formEventType}
                onChange={e => setFormEventType(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
              >
                {EVENT_TYPES.map(et => (
                  <option key={et} value={et}>{EVENT_TYPE_LABELS[et]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Pontos</label>
              <input
                type="number"
                value={formPoints}
                onChange={e => setFormPoints(parseInt(e.target.value) || 0)}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Descrição (opcional)</label>
              <input
                type="text"
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
                placeholder="Descrição da regra"
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={cancelEdit}>
              <X size={14} className="mr-1" /> Cancelar
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={saving || !formName.trim()}>
              <Check size={14} className="mr-1" /> Criar Regra
            </Button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="pt-6 border-t border-gray-300 flex gap-3">
        {!showCreate && (
          <Button
            onClick={() => { resetForm(); setShowCreate(true); setEditingId(null); }}
            className="bg-primary hover:bg-primary-dark"
          >
            <Plus size={16} className="mr-2" />
            Nova Regra
          </Button>
        )}
        <Button
          variant="outline"
          onClick={handleRecalculate}
          disabled={recalculating}
        >
          <RefreshCw size={16} className={`mr-2 ${recalculating ? 'animate-spin' : ''}`} />
          {recalculating ? 'Recalculando...' : 'Recalcular Scores'}
        </Button>
      </div>
    </div>
  );
}
