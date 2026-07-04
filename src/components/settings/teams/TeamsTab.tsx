import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Users2 } from 'lucide-react';
import { Button } from '../../ui/button';
import { LoadingButton } from '../../ui/loading-button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Skeleton } from '../../ui/skeleton';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '../../ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { apiClient } from '../../../services/api/client';
import type { Team, CreateTeamInput } from '../../../types/governance';

// Radix Select proíbe SelectItem com value="". Sentinel para "Sem líder".
const NO_LEADER = '__none__';

interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface TeamsTabProps {
  /** Usuários do tenant (para escolher líder/membros). */
  users: UserOption[];
  loadingUsers: boolean;
}

export function TeamsTab({ users, loadingUsers }: TeamsTabProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog de criar/editar
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formLeaderId, setFormLeaderId] = useState<string>('');
  const [formMemberIds, setFormMemberIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Exclusão
  const [deletingTeam, setDeletingTeam] = useState<Team | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.getTeams();
      setTeams(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar equipes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users) map.set(u.id, u.name);
    return map;
  }, [users]);

  const openCreate = () => {
    setEditingTeam(null);
    setFormName('');
    setFormLeaderId('');
    setFormMemberIds([]);
    setDialogOpen(true);
  };

  const openEdit = (team: Team) => {
    setEditingTeam(team);
    setFormName(team.name);
    setFormLeaderId(team.leaderId || '');
    setFormMemberIds((team.members || []).map((m) => m.id));
    setDialogOpen(true);
  };

  const toggleMember = (id: string) => {
    setFormMemberIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    const name = formName.trim();
    if (!name) {
      toast.error('Informe o nome da equipe');
      return;
    }
    setSaving(true);
    try {
      const payload: CreateTeamInput = {
        name,
        leaderId: formLeaderId || null,
        memberIds: formMemberIds,
      };
      if (editingTeam) {
        await apiClient.updateTeam(editingTeam.id, payload);
        toast.success('Equipe atualizada com sucesso');
      } else {
        await apiClient.createTeam(payload);
        toast.success('Equipe criada com sucesso');
      }
      setDialogOpen(false);
      fetchTeams();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar equipe');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTeam) return;
    setDeleting(true);
    try {
      await apiClient.deleteTeam(deletingTeam.id);
      toast.success('Equipe excluída com sucesso');
      setDeletingTeam(null);
      fetchTeams();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao excluir equipe');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Organize os membros em equipes para metas coletivas e visibilidade por equipe.
        </p>
        <Button onClick={openCreate} className="bg-primary hover:bg-primary-dark">
          <Plus size={16} className="mr-2" />
          Nova Equipe
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Líder</TableHead>
            <TableHead>Membros</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            [1, 2, 3].map((row) => (
              <TableRow key={row}>
                {Array.from({ length: 4 }).map((_, col) => (
                  <TableCell key={col}>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : teams.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4}>
                <div className="text-center py-12">
                  <Users2 size={40} className="mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">Nenhuma equipe cadastrada</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Crie a primeira equipe para agrupar seus colaboradores
                  </p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            teams.map((team) => (
              <TableRow key={team.id}>
                <TableCell className="font-medium text-foreground">{team.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {team.leader?.name ||
                    (team.leaderId ? userNameById.get(team.leaderId) : null) ||
                    '—'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {team.members?.length ?? 0}{' '}
                  {(team.members?.length ?? 0) === 1 ? 'membro' : 'membros'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex gap-1">
                    <button
                      onClick={() => openEdit(team)}
                      className="p-2 rounded transition-colors hover:bg-accent"
                      aria-label={`Editar equipe ${team.name}`}
                      title="Editar equipe"
                    >
                      <Pencil size={16} className="text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => setDeletingTeam(team)}
                      className="p-2 rounded transition-colors hover:bg-destructive/10"
                      aria-label={`Excluir equipe ${team.name}`}
                      title="Excluir equipe"
                    >
                      <Trash2 size={16} className="text-destructive" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Dialog criar/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTeam ? 'Editar Equipe' : 'Nova Equipe'}</DialogTitle>
            <DialogDescription>
              Defina o nome, o líder e os membros da equipe.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="team-name">Nome</Label>
              <Input
                id="team-name"
                placeholder="Ex.: Vendas Sudeste"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Líder</Label>
              <Select
                value={formLeaderId || NO_LEADER}
                onValueChange={(v) => setFormLeaderId(v === NO_LEADER ? '' : v)}
                disabled={loadingUsers}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o líder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_LEADER}>Sem líder</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Membros</Label>
              {loadingUsers ? (
                <Skeleton className="h-24 w-full" />
              ) : users.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum usuário disponível.</p>
              ) : (
                <div className="max-h-56 overflow-y-auto rounded-md border border-border divide-y divide-border">
                  {users.map((u) => {
                    const checked = formMemberIds.includes(u.id);
                    const inputId = `team-member-${u.id}`;
                    return (
                      <label
                        key={u.id}
                        htmlFor={inputId}
                        className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-accent"
                      >
                        <input
                          id={inputId}
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={checked}
                          onChange={() => toggleMember(u.id)}
                        />
                        <span className="flex-1 text-sm text-foreground">{u.name}</span>
                        <span className="text-xs text-muted-foreground">{u.email}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {formMemberIds.length}{' '}
                {formMemberIds.length === 1 ? 'membro selecionado' : 'membros selecionados'}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <LoadingButton
              loading={saving}
              loadingText="Salvando..."
              onClick={handleSave}
              className="bg-primary hover:bg-primary-dark"
            >
              Salvar
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog
        open={!!deletingTeam}
        onOpenChange={(open) => !open && setDeletingTeam(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir equipe</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a equipe{' '}
              <strong>{deletingTeam?.name}</strong>? Os membros serão desvinculados. Esta ação
              não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? 'Excluindo...' : 'Excluir Equipe'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
