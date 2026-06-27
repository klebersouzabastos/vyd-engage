import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Skeleton } from '../ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Plus, Edit2, Trash2, ChevronLeft, ChevronRight, Target } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { formatCurrency } from '../../utils/format';

interface GoalUser {
  id: string;
  name: string;
  email: string;
}

interface Goal {
  id: string;
  userId: string;
  month: number;
  year: number;
  targetRevenue: number;
  targetDeals: number;
  targetLeads: number;
  user: GoalUser;
}

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const emptyForm = {
  userId: '',
  targetRevenue: 0,
  targetDeals: 0,
  targetLeads: 0,
};

export function GoalsTab() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [goals, setGoals] = useState<Goal[]>([]);
  const [users, setUsers] = useState<GoalUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Goal | null>(null);

  const loadGoals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.getGoals({ month, year });
      const data = (res as any)?.data ?? res ?? [];
      setGoals(data as Goal[]);
    } catch {
      toast.error('Erro ao carregar metas');
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  const loadUsers = useCallback(async () => {
    try {
      const data = await apiClient.getUsers();
      setUsers(data as GoalUser[]);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const openCreate = () => {
    setEditingGoal(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setForm({
      userId: goal.userId,
      targetRevenue: goal.targetRevenue,
      targetDeals: goal.targetDeals,
      targetLeads: goal.targetLeads,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.userId) {
      toast.error('Selecione um vendedor');
      return;
    }
    setSaving(true);
    try {
      await apiClient.upsertGoal({
        userId: form.userId,
        month,
        year,
        targetRevenue: Number(form.targetRevenue) || 0,
        targetDeals: Number(form.targetDeals) || 0,
        targetLeads: Number(form.targetLeads) || 0,
      });
      toast.success(editingGoal ? 'Meta atualizada' : 'Meta criada');
      setModalOpen(false);
      loadGoals();
    } catch {
      toast.error('Erro ao salvar meta');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiClient.deleteGoal(deleteTarget.id);
      toast.success('Meta removida');
      setDeleteTarget(null);
      loadGoals();
    } catch {
      toast.error('Erro ao remover meta');
    }
  };

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  const usersWithoutGoal = users.filter((u) => !goals.some((g) => g.userId === u.id));
  const availableUsers = editingGoal ? users : usersWithoutGoal;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Metas por Vendedor</h3>
        <p className="text-sm text-gray-500 mt-1">
          Defina metas mensais de receita, negócios e leads para cada membro da equipe.
        </p>
      </div>

      {/* Period selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded hover:bg-gray-100 transition-colors"
            aria-label="Mês anterior"
          >
            <ChevronLeft size={18} className="text-gray-600" />
          </button>
          <span className="font-medium text-gray-900 min-w-[160px] text-center">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded hover:bg-gray-100 transition-colors"
            aria-label="Próximo mês"
          >
            <ChevronRight size={18} className="text-gray-600" />
          </button>
        </div>

        <Button onClick={openCreate} disabled={usersWithoutGoal.length === 0 && !loading}>
          <Plus size={16} className="mr-2" />
          Nova Meta
        </Button>
      </div>

      {/* Goals table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendedor</TableHead>
              <TableHead className="text-right">Receita (R$)</TableHead>
              <TableHead className="text-right">Negócios</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [1, 2, 3].map((i) => (
                <TableRow key={i}>
                  {[1, 2, 3, 4, 5].map((j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : goals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <div className="text-center py-10">
                    <Target size={36} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 text-sm">
                      Nenhuma meta definida para {MONTH_NAMES[month - 1]} {year}
                    </p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}>
                      <Plus size={14} className="mr-1" />
                      Criar primeira meta
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              goals.map((goal) => (
                <TableRow key={goal.id}>
                  <TableCell className="font-medium text-gray-900">
                    <div>
                      <span>{goal.user.name}</span>
                      <span className="text-xs text-gray-400 ml-2">{goal.user.email}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-gray-700">
                    {formatCurrency(goal.targetRevenue)}
                  </TableCell>
                  <TableCell className="text-right text-gray-700">{goal.targetDeals}</TableCell>
                  <TableCell className="text-right text-gray-700">{goal.targetLeads}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => openEdit(goal)}
                        className="p-2 hover:bg-gray-100 rounded transition-colors"
                        title="Editar meta"
                      >
                        <Edit2 size={15} className="text-gray-600" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(goal)}
                        className="p-2 hover:bg-red-50 rounded transition-colors"
                        title="Remover meta"
                      >
                        <Trash2 size={15} className="text-red-500" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Modal */}
      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          if (!open) setModalOpen(false);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingGoal ? 'Editar Meta' : 'Nova Meta'} — {MONTH_NAMES[month - 1]} {year}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {!editingGoal && (
              <div className="space-y-2">
                <Label>Vendedor</Label>
                <Select
                  value={form.userId}
                  onValueChange={(v) => setForm((f) => ({ ...f, userId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o vendedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="targetRevenue">Meta de Receita (R$)</Label>
              <Input
                id="targetRevenue"
                type="number"
                min={0}
                step={100}
                value={form.targetRevenue}
                onChange={(e) => setForm((f) => ({ ...f, targetRevenue: Number(e.target.value) }))}
                placeholder="0"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="targetDeals">Negócios</Label>
                <Input
                  id="targetDeals"
                  type="number"
                  min={0}
                  value={form.targetDeals}
                  onChange={(e) => setForm((f) => ({ ...f, targetDeals: Number(e.target.value) }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetLeads">Leads</Label>
                <Input
                  id="targetLeads"
                  type="number"
                  min={0}
                  value={form.targetLeads}
                  onChange={(e) => setForm((f) => ({ ...f, targetLeads: Number(e.target.value) }))}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover meta</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja remover a meta de <strong>{deleteTarget?.user.name}</strong> para{' '}
              {MONTH_NAMES[month - 1]} {year}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
