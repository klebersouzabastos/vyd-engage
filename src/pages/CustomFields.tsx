import { useState } from 'react';
import { toast } from 'sonner';
import { Header } from '../components/Header';
import { Plus, Edit2, Trash2, GripVertical } from 'lucide-react';
import { useCustomFields } from '../contexts/CustomFieldsContext';
import { CustomField } from '../types';
import { CustomFieldEditor } from '../components/CustomFieldEditor';
import { ScreenRibbon } from '@/contexts/RibbonContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';

export function CustomFields() {
  const { fields, createField, updateField, deleteField, reorderFields } = useCustomFields();
  const [editingField, setEditingField] = useState<CustomField | undefined>();
  const [deletingField, setDeletingField] = useState<CustomField | undefined>();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = () => {
    setEditingField(undefined);
    setIsCreating(true);
  };

  const handleEdit = (field: CustomField) => {
    setEditingField(field);
    setIsCreating(false);
  };

  const handleSave = (fieldData: Omit<CustomField, 'id'>) => {
    try {
      if (editingField) {
        updateField(editingField.id, fieldData);
        setEditingField(undefined);
      } else {
        createField(fieldData);
        setIsCreating(false);
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar campo');
    }
  };

  const handleCancel = () => {
    setEditingField(undefined);
    setIsCreating(false);
  };

  const handleDelete = () => {
    if (!deletingField) return;
    deleteField(deletingField.id);
    setDeletingField(undefined);
  };

  const getTypeLabel = (type: CustomField['type']) => {
    const labels: Record<CustomField['type'], string> = {
      text: 'Texto',
      number: 'Número',
      date: 'Data',
      textarea: 'Texto Longo',
      select: 'Seleção',
      multiselect: 'Seleção múltipla',
      checkbox: 'Checkbox',
    };
    return labels[type];
  };

  return (
    <div className="min-h-screen">
      <ScreenRibbon
        groups={[
          {
            label: 'Campos',
            items: [{ icon: Plus, label: 'Novo Campo', onClick: handleCreate }],
          },
        ]}
      />
      <Header title="Campos Customizados" subtitle="Crie campos personalizados para seus leads" />

      <div className="p-8">
        <div className="bg-card rounded-lg shadow-sm border border-gray-300">
          <div className="p-6 border-b border-gray-300">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Campos Customizados</h3>
              <p className="text-sm text-gray-600 mt-1">
                Adicione campos personalizados para capturar informações específicas dos seus leads
              </p>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Lista de Campos */}
              <div className="space-y-3">
                {fields.length === 0 && !isCreating && !editingField ? (
                  <div className="text-center py-12 border border-gray-300 rounded-lg bg-gray-100">
                    <p className="text-gray-600">Nenhum campo customizado criado ainda</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Crie seu primeiro campo para começar a personalizar seus leads
                    </p>
                  </div>
                ) : (
                  fields.map((field) => (
                    <div
                      key={field.id}
                      className={`flex items-center gap-4 p-4 border rounded-lg bg-card hover:shadow-md transition-shadow ${
                        editingField?.id === field.id
                          ? 'border-primary border-2'
                          : 'border-gray-300'
                      }`}
                    >
                      <div className="text-gray-400 cursor-move">
                        <GripVertical size={20} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-900">{field.name}</h4>
                          {field.required && <span className="text-xs text-red-500">*</span>}
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                            {getTypeLabel(field.type)}
                          </span>
                        </div>
                        {field.type === 'select' && field.options && (
                          <p className="text-sm text-gray-600 mt-1">
                            Opções: {field.options.join(', ')}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(field)}
                          className="p-2 hover:bg-gray-100 rounded transition-colors"
                          aria-label="Editar campo"
                          disabled={!!editingField || isCreating}
                        >
                          <Edit2 size={16} className="text-gray-600" />
                        </button>
                        <button
                          onClick={() => setDeletingField(field)}
                          className="p-2 hover:bg-red-50 rounded transition-colors"
                          aria-label="Deletar campo"
                          disabled={!!editingField || isCreating}
                        >
                          <Trash2 size={16} className="text-red-600" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Formulário de Criar/Editar */}
              {(isCreating || editingField) && (
                <div className="lg:border-l lg:pl-6 lg:border-gray-300">
                  <div className="sticky top-4">
                    <CustomFieldEditor
                      field={editingField}
                      inline={true}
                      onClose={handleCancel}
                      onSave={handleSave}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingField}
        onOpenChange={(open) => !open && setDeletingField(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar o campo "{deletingField?.name}"? Todos os valores deste
              campo serão removidos dos leads.
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
