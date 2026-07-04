import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, ShieldCheck, Eye } from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../ui/alert-dialog';
import { apiClient } from '../../../services/api/client';
import type { PermissionProfile } from '../../../types/governance';
import { BASE_ROLE_LABELS } from './permissionLabels';
import { PermissionProfileEditor } from './PermissionProfileEditor';
import { BuiltinProfileViewer } from './BuiltinProfileViewer';

export function PermissionsTab() {
  const [profiles, setProfiles] = useState<PermissionProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<PermissionProfile | null>(null);

  const [deletingProfile, setDeletingProfile] = useState<PermissionProfile | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.getPermissionProfiles();
      setProfiles(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar perfis');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  // Builtins primeiro (na ordem dos papéis), depois custom por nome.
  const sortedProfiles = useMemo(() => {
    const rank: Record<string, number> = { ADMIN: 0, GESTOR: 1, USER: 2, VIEWER: 3 };
    return [...profiles].sort((a, b) => {
      if (a.isBuiltin !== b.isBuiltin) return a.isBuiltin ? -1 : 1;
      if (a.isBuiltin && b.isBuiltin) return (rank[a.baseRole] ?? 9) - (rank[b.baseRole] ?? 9);
      return a.name.localeCompare(b.name, 'pt-BR');
    });
  }, [profiles]);

  const openCreate = () => {
    setEditingProfile(null);
    setEditorOpen(true);
  };

  const openView = (profile: PermissionProfile) => {
    setEditingProfile(profile);
    setEditorOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingProfile) return;
    setDeleting(true);
    try {
      await apiClient.deletePermissionProfile(deletingProfile.id);
      toast.success('Perfil excluído com sucesso');
      setDeletingProfile(null);
      fetchProfiles();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao excluir perfil');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Perfis controlam capacidades, visibilidade e aprovações. Os 4 perfis padrão são
          imutáveis; crie perfis personalizados para regras específicas.
        </p>
        <Button onClick={openCreate} className="bg-primary hover:bg-primary-dark">
          <Plus size={16} className="mr-2" />
          Novo Perfil
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Perfil</TableHead>
            <TableHead>Papel-base</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            [1, 2, 3, 4].map((row) => (
              <TableRow key={row}>
                {Array.from({ length: 4 }).map((_, col) => (
                  <TableCell key={col}>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : sortedProfiles.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4}>
                <div className="text-center py-12">
                  <ShieldCheck size={40} className="mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">Nenhum perfil encontrado</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            sortedProfiles.map((profile) => (
              <TableRow key={profile.id}>
                <TableCell>
                  <div className="font-medium text-foreground">{profile.name}</div>
                  {profile.description && (
                    <div className="text-xs text-muted-foreground">{profile.description}</div>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {BASE_ROLE_LABELS[profile.baseRole]}
                </TableCell>
                <TableCell>
                  {profile.isBuiltin ? (
                    <Badge variant="secondary">Padrão</Badge>
                  ) : (
                    <Badge variant="outline">Personalizado</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex gap-1">
                    <button
                      onClick={() => openView(profile)}
                      className="p-2 rounded transition-colors hover:bg-accent"
                      aria-label={
                        profile.isBuiltin
                          ? `Ver perfil ${profile.name}`
                          : `Editar perfil ${profile.name}`
                      }
                      title={profile.isBuiltin ? 'Ver perfil (somente leitura)' : 'Editar perfil'}
                    >
                      {profile.isBuiltin ? (
                        <Eye size={16} className="text-muted-foreground" />
                      ) : (
                        <Pencil size={16} className="text-muted-foreground" />
                      )}
                    </button>
                    {!profile.isBuiltin && (
                      <button
                        onClick={() => setDeletingProfile(profile)}
                        className="p-2 rounded transition-colors hover:bg-destructive/10"
                        aria-label={`Excluir perfil ${profile.name}`}
                        title="Excluir perfil"
                      >
                        <Trash2 size={16} className="text-destructive" />
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Builtin → visualizador read-only; custom (ou novo) → editor. */}
      {editingProfile?.isBuiltin ? (
        <BuiltinProfileViewer
          open={editorOpen}
          onOpenChange={setEditorOpen}
          profile={editingProfile}
        />
      ) : (
        <PermissionProfileEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          profile={editingProfile}
          onSaved={fetchProfiles}
        />
      )}

      <AlertDialog
        open={!!deletingProfile}
        onOpenChange={(open) => !open && setDeletingProfile(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir perfil</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o perfil{' '}
              <strong>{deletingProfile?.name}</strong>? Usuários com este perfil voltam ao
              comportamento padrão do papel. Esta ação não pode ser desfeita.
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
              {deleting ? 'Excluindo...' : 'Excluir Perfil'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
