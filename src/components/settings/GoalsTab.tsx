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
import { Plus, Edit2, Trash2, ChevronLeft, ChevronRight, Target, User, Users } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { formatCurrency } from '../../utils/format';
import type { Team } from '../../types/governance';

interface GoalUser {
  id: string;
  name: string;
  email: string;
}

type GoalType = 'individual' | 'team';

interface Goal {
  id: string;
  // Upgrade RD P1 (req 12): meta individual (userId) OU de equipe (teamId).
  userId: string | null;
  teamId: string | null;
  month: number;
  year: number;
  targetRevenue: number;
  targetDeals: number;
  targetLeads: number;
  user: GoalUser | null;
  team: { id: string; name: string } | null;
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
  goalType: 'individual' as GoalType,
  userId: '',
  teamId: '',
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
  const [teams, setTeams] = useState<Team[]>([]);
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
      setGoals((res.data ?? []) as unknown as Goal[]);
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

  // Equipes para metas de equipe (Upgrade RD P1, req 12).
  const loadTeams = useCallback(async () => {
    try {
      const res = await apiClient.getTeams();
      setTeams(res.data ?? []);
    } catch {
      // silent — sem equipes, o form fica só com o modo Individual.
    }
  }, []);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);
  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  const openCreate = () => {
    setEditingGoal(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setForm({
      goalType: goal.teamId ? 'team' : 'individual',
      userId: goal.userId ?? '',
      teamId: goal.teamId ?? '',
      targetRevenue: goal.targetRevenue,
      targetDeals: goal.targetDeals,
      targetLeads: goal.targetLeads,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    const isTeam = form.goalType === 'team';
    if (isTeam && !form.teamId) {
      toast.error('Selecione uma equipe');
      return;
    }
    if (!isTeam && !form.userId) {
      toast.error('Selecione um vendedor');
      return;
    }
    setSaving(true);
    try {
      // Upgrade RD P1 (req 12): envia userId OU teamId (exatamente um; validado no backend).
      await apiClient.upsertGoal({
        ...(isTeam ? { teamId: form.teamId } : { userId: form.userId }),
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
  const teamsWithoutGoal = teams.filter((t) => !goals.some((g) => g.teamId === t.id));
  const availableUsers = editingGoal ? users : usersWithoutGoal;
  const availableTeams = editingGoal ? teams : teamsWithoutGoal;
  // "Nova Meta" fica disponível se ainda há vendedor OU equipe sem meta no período.
  const canCreate = usersWithoutGoal.length > 0 || teamsWithoutGoal.length > 0;

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

        <Button onClick={openCreate} disabled={!canCreate && !loading}>
          <Plus size={16} className="mr-2" />
          Nova Meta
        </Button>
      </div>

      {/* Goals table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendedor / Equipe</TableHead>
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
                    {goal.teamId ? (
                      <div className="flex items-center gap-2">
                        <Users size={15} className="text-gray-400 flex-shrink-0" />
                        <span>{goal.team?.name ?? '—'}</span>
                        <span className="text-xs text-gray-400">Equipe</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <User size={15} className="text-gray-400 flex-shrink-0" />
                        <span>{goal.user?.name ?? '—'}</span>
                        <span className="text-xs text-gray-400">{goal.user?.email}</span>
                      </div>
                    )}
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
              <>
                {/* Alternância Individual | Equipe (Upgrade RD P1, req 12) — só
                    aparece com equipes cadastradas; sem equipes fica só Individual. */}
                {teams.length > 0 && (
                  <div className="space-y-2">
                    <Label>Tipo de meta</Label>
                    <div className="flex items-center gap-1 bg-gray-50 border border-gray-300 rounded-lg p-1 w-full">
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({ ...f, goalType: 'individual', teamId: '' }))
                        }
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                          form.goalType === 'individual'
                            ? 'bg-primary text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <User size={14} />
                        Individual
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, goalType: 'team', userId: '' }))}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                          form.goalType === 'team'
                            ? 'bg-primary text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <Users size={14} />
                        Equipe
                      </button>
                    </div>
                  </div>
                )}

                {form.goalType === 'team' ? (
                  <div className="space-y-2">
                    <Label>Equipe</Label>
                    <Select
                      value={form.teamId}
                      onValueChange={(v) => setForm((f) => ({ ...f, teamId: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a equipe" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTeams.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {availableTeams.length === 0 && (
                      <p className="text-xs text-gray-400">
                        Todas as equipes já têm meta neste período.
                      </p>
                    )}
                  </div>
                ) : (
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
              </>
            )}

            {editingGoal && (
              <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                {editingGoal.teamId ? (
                  <>
                    <Users size={15} className="text-gray-400" />
                    <span>
                      Meta da equipe{' '}
                      <span className="font-medium text-gray-900">{editingGoal.team?.name}</span>
                    </span>
                  </>
                ) : (
                  <>
                    <User size={15} className="text-gray-400" />
                    <span>
                      Meta de{' '}
                      <span className="font-medium text-gray-900">{editingGoal.user?.name}</span>
                    </span>
                  </>
                )}
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
              Deseja remover a meta{' '}
              {deleteTarget?.teamId ? 'da equipe' : 'de'}{' '}
              <strong>{deleteTarget?.teamId ? deleteTarget?.team?.name : deleteTarget?.user?.name}</strong>{' '}
              para {MONTH_NAMES[month - 1]} {year}?
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
