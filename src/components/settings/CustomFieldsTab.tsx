import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
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
import { Plus, Edit2, Trash2, X } from 'lucide-react';
import { useCustomFields } from '../../contexts/CustomFieldsContext';
import { CustomFieldEditor } from '../CustomFieldEditor';

export function CustomFieldsTab() {
  const { fields: customFields, createField, updateField, deleteField } = useCustomFields();
  const [isCreatingCustomField, setIsCreatingCustomField] = useState(false);
  const [editingCustomFieldId, setEditingCustomFieldId] = useState<string | null>(null);
  const [fieldToDelete, setFieldToDelete] = useState<{ id: string; name: string } | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Campos Customizados</h3>
          <p className="text-sm text-gray-600">
            Crie campos personalizados para capturar informacoes especificas dos seus leads
          </p>
          <p className="text-xs text-gray-600 mt-1">
            {customFields.length} campo{customFields.length !== 1 ? 's' : ''} criado
            {customFields.length !== 1 ? 's' : ''}
          </p>
        </div>
        {!isCreatingCustomField && !editingCustomFieldId && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsCreatingCustomField(true);
              setEditingCustomFieldId(null);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Campo
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lista de Campos */}
        <div className="space-y-3">
          {customFields.length > 0
            ? customFields.map((field) => (
                <div
                  key={field.id}
                  className={`flex items-center gap-4 p-4 border rounded-lg bg-white hover:shadow-md transition-shadow ${
                    editingCustomFieldId === field.id
                      ? 'border-primary border-2'
                      : 'border-gray-300'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900">{field.name}</h4>
                      {field.required && <span className="text-xs text-red-500">*</span>}
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                        {field.type === 'text'
                          ? 'Texto'
                          : field.type === 'number'
                            ? 'Numero'
                            : field.type === 'date'
                              ? 'Data'
                              : field.type === 'textarea'
                                ? 'Texto Longo'
                                : field.type === 'select'
                                  ? 'Selecao'
                                  : field.type === 'checkbox'
                                    ? 'Checkbox'
                                    : field.type}
                      </span>
                    </div>
                    {field.type === 'select' && field.options && (
                      <p className="text-sm text-gray-600 mt-1">
                        Opcoes: {field.options.join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingCustomFieldId(field.id);
                        setIsCreatingCustomField(false);
                      }}
                      className="p-2 hover:bg-gray-100 rounded transition-colors"
                      aria-label="Editar campo"
                      disabled={!!editingCustomFieldId || isCreatingCustomField}
                    >
                      <Edit2 size={16} className="text-gray-600" />
                    </button>
                    <button
                      onClick={() => setFieldToDelete({ id: field.id, name: field.name })}
                      className="p-2 hover:bg-red-50 rounded transition-colors"
                      aria-label="Deletar campo"
                      disabled={!!editingCustomFieldId || isCreatingCustomField}
                    >
                      <Trash2 size={16} className="text-red-600" />
                    </button>
                  </div>
                </div>
              ))
            : !isCreatingCustomField &&
              !editingCustomFieldId && (
                <div className="p-4 bg-gray-100 rounded-lg text-center">
                  <p className="text-sm text-gray-600">Nenhum campo customizado criado ainda</p>
                </div>
              )}
        </div>

        {/* Formulario de Adicionar/Editar */}
        {(isCreatingCustomField || editingCustomFieldId) && (
          <div className="lg:border-l lg:pl-6 lg:border-gray-300">
            <div className="sticky top-4">
              <CustomFieldEditor
                field={
                  editingCustomFieldId
                    ? customFields.find((f) => f.id === editingCustomFieldId)
                    : undefined
                }
                inline={true}
                onClose={() => {
                  setIsCreatingCustomField(false);
                  setEditingCustomFieldId(null);
                }}
                onSave={(fieldData) => {
                  try {
                    if (editingCustomFieldId) {
                      updateField(editingCustomFieldId, fieldData);
                      setEditingCustomFieldId(null);
                    } else {
                      createField(fieldData);
                      setIsCreatingCustomField(false);
                    }
                  } catch (error: any) {
                    toast.error(error.message || 'Erro ao salvar campo');
                  }
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!fieldToDelete} onOpenChange={(open) => !open && setFieldToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Campo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar o campo "{fieldToDelete?.name}"? Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (fieldToDelete) {
                  deleteField(fieldToDelete.id);
                  if (editingCustomFieldId === fieldToDelete.id) {
                    setEditingCustomFieldId(null);
                  }
                }
                setFieldToDelete(null);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
