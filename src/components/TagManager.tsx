import { useState } from 'react';
import { toast } from 'sonner';
import { Trash2, Edit2, Plus, X } from 'lucide-react';
import { Tag } from '../types';
import { useTags } from '../contexts/TagsContext';
import { TAG_COLORS } from '../utils/tags';
import { TagBadge } from './TagBadge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

export function TagManager() {
  const { tags, createTag, updateTag, deleteTag, getUsageCount } = useTags();
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [deletingTag, setDeletingTag] = useState<Tag | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    color: TAG_COLORS[0],
  });

  const handleCreate = () => {
    if (!formData.name.trim()) return;

    try {
      createTag({
        name: formData.name.trim(),
        color: formData.color,
      });
      setFormData({ name: '', color: TAG_COLORS[0] });
      setIsCreateDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar tag');
    }
  };

  const handleEdit = (tag: Tag) => {
    setEditingTag(tag);
    setFormData({ name: tag.name, color: tag.color });
    setIsCreateDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!editingTag || !formData.name.trim()) return;

    try {
      updateTag(editingTag.id, {
        name: formData.name.trim(),
        color: formData.color,
      });
      setEditingTag(null);
      setFormData({ name: '', color: TAG_COLORS[0] });
      setIsCreateDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao atualizar tag');
    }
  };

  const handleDelete = () => {
    if (!deletingTag) return;
    deleteTag(deletingTag.id);
    setDeletingTag(null);
  };

  const handleCloseDialog = () => {
    setIsCreateDialogOpen(false);
    setEditingTag(null);
    setFormData({ name: '', color: TAG_COLORS[0] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Gerenciar Tags</h3>
          <p className="text-sm text-gray-600 mt-1">
            Crie e gerencie tags para categorizar seus leads
          </p>
        </div>
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          className="bg-primary hover:bg-primary-dark"
        >
          <Plus size={16} className="mr-2" />
          Nova Tag
        </Button>
      </div>

      {/* Lista de tags */}
      {tags.length === 0 ? (
        <div className="text-center py-12 border border-gray-300 rounded-lg bg-gray-100">
          <p className="text-gray-600">Nenhuma tag criada ainda</p>
          <p className="text-sm text-gray-600 mt-1">
            Crie sua primeira tag para começar a categorizar leads
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tags.map((tag) => {
            const usageCount = getUsageCount(tag.id);
            return (
              <div
                key={tag.id}
                className="p-4 border border-gray-300 rounded-lg bg-white hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <TagBadge tag={tag} size="md" />
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEdit(tag)}
                      className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                      aria-label="Editar tag"
                    >
                      <Edit2 size={14} className="text-gray-600" />
                    </button>
                    <button
                      onClick={() => setDeletingTag(tag)}
                      className="p-1.5 hover:bg-red-50 rounded transition-colors"
                      aria-label="Deletar tag"
                    >
                      <Trash2 size={14} className="text-red-600" />
                    </button>
                  </div>
                </div>
                <div className="text-xs text-gray-600">Usada em {usageCount} lead(s)</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Formulário de criar/editar - inline na mesma tela */}
      {isCreateDialogOpen && (
        <div className="border border-gray-300 rounded-lg bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-900">
              {editingTag ? 'Editar Tag' : 'Nova Tag'}
            </h4>
            <Button variant="ghost" size="sm" onClick={handleCloseDialog} className="h-8 w-8 p-0">
              <X size={16} />
            </Button>
          </div>
          <div className="space-y-4">
            <div>
              <Label htmlFor="tag-name">Nome da Tag</Label>
              <Input
                id="tag-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Cliente VIP, Prospect, etc."
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap mt-1.5">
                {TAG_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`
                      w-10 h-10 rounded-lg border-2 transition-all
                      ${
                        formData.color === color
                          ? 'border-gray-900 scale-110'
                          : 'border-gray-300 hover:border-gray-400'
                      }
                    `}
                    style={{ backgroundColor: color }}
                    aria-label={`Selecionar cor ${color}`}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button
                onClick={editingTag ? handleUpdate : handleCreate}
                className="bg-primary hover:bg-primary-dark"
              >
                {editingTag ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!deletingTag} onOpenChange={(open) => !open && setDeletingTag(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar a tag "{deletingTag?.name}"?
              {deletingTag &&
                getUsageCount(deletingTag.id) > 0 &&
                ` Ela está sendo usada em ${getUsageCount(deletingTag.id)} lead(s).`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
