import { Interaction } from '../types';
import { toast } from 'sonner';
import { formatRelativeTime } from '../utils/interactions';
import {
  MessageSquare,
  Phone,
  Mail,
  Calendar,
  FileText,
  GitBranch,
  Zap,
  Trash2,
  Plus,
  X,
} from 'lucide-react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
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
import { useState } from 'react';
import { sanitizeRichHtml, isRichHtml } from '@/lib/richText';

interface InteractionTimelineProps {
  leadId: number;
  interactions: Interaction[];
  onDelete: (interactionId: string) => void;
  onAdd: (interaction: Omit<Interaction, 'id' | 'leadId' | 'timestamp'>) => void;
}

const getInteractionIcon = (type: Interaction['type']) => {
  switch (type) {
    case 'note':
      return FileText;
    case 'call':
      return Phone;
    case 'email':
      return Mail;
    case 'whatsapp':
      return MessageSquare;
    case 'meeting':
      return Calendar;
    case 'status_change':
      return GitBranch;
    case 'automation':
      return Zap;
    default:
      return FileText;
  }
};

const getInteractionColor = (type: Interaction['type']) => {
  switch (type) {
    case 'note':
      return 'bg-blue-100 text-blue-600';
    case 'call':
      return 'bg-green-100 text-green-600';
    case 'email':
      return 'bg-purple-100 text-purple-600';
    case 'whatsapp':
      return 'bg-emerald-100 text-emerald-600';
    case 'meeting':
      return 'bg-orange-100 text-orange-600';
    case 'status_change':
      return 'bg-indigo-100 text-indigo-600';
    case 'automation':
      return 'bg-yellow-100 text-yellow-600';
    default:
      return 'bg-gray-100 text-gray-600';
  }
};

const getInteractionLabel = (type: Interaction['type']) => {
  switch (type) {
    case 'note':
      return 'Nota';
    case 'call':
      return 'Chamada';
    case 'email':
      return 'E-mail';
    case 'whatsapp':
      return 'WhatsApp';
    case 'meeting':
      return 'Reunião';
    case 'status_change':
      return 'Mudança de Status';
    case 'automation':
      return 'Automação';
    default:
      return 'Interação';
  }
};

export function InteractionTimeline({
  leadId,
  interactions,
  onDelete,
  onAdd,
}: InteractionTimelineProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    type: 'note' as Interaction['type'],
    content: '',
    customDate: '',
    customTime: '',
  });

  const handleSave = () => {
    if (!formData.content.trim()) {
      toast.error('O conteúdo da interação é obrigatório');
      return;
    }

    let timestamp = new Date().toISOString();

    // Se data/hora customizada foi fornecida, usar ela
    if (formData.customDate && formData.customTime) {
      const customDateTime = new Date(`${formData.customDate}T${formData.customTime}`);
      if (!isNaN(customDateTime.getTime())) {
        timestamp = customDateTime.toISOString();
      }
    }

    const metadata: Record<string, any> = {};
    if (formData.type === 'call') {
      metadata.duration = 'Não especificada';
    }
    if (formData.type === 'meeting') {
      metadata.location = 'Não especificada';
    }

    onAdd({
      type: formData.type,
      content: formData.content.trim(),
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    });

    // Reset form
    setFormData({
      type: 'note',
      content: '',
      customDate: '',
      customTime: '',
    });
    setShowAddForm(false);
  };

  const handleCancel = () => {
    setFormData({
      type: 'note',
      content: '',
      customDate: '',
      customTime: '',
    });
    setShowAddForm(false);
  };

  if (interactions.length === 0 && !showAddForm) {
    return (
      <div className="text-center py-12">
        <FileText size={48} className="mx-auto text-gray-400 mb-4" />
        <p className="text-gray-600 mb-2">Nenhuma interação registrada</p>
        <p className="text-sm text-gray-400 mb-6">Comece a registrar interações com este lead</p>
        <Button
          onClick={() => setShowAddForm(true)}
          className="bg-primary hover:bg-primary-dark text-white shadow-sm hover:shadow-md transition-all duration-200 px-6 py-2.5 font-medium"
        >
          <Plus size={18} className="mr-2" />
          Adicionar Interação
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h4 className="font-semibold text-gray-900 text-base">
          Histórico de Interações ({interactions.length})
        </h4>
        {!showAddForm && (
          <Button
            onClick={() => setShowAddForm(true)}
            className="bg-primary hover:bg-primary-dark text-white shadow-sm hover:shadow-md transition-all duration-200 px-4 py-2 font-medium flex items-center gap-2"
          >
            <Plus size={16} />
            Adicionar Interação
          </Button>
        )}
      </div>

      {/* Formulário inline para adicionar interação */}
      {showAddForm && (
        <div className="relative flex gap-4 mb-6">
          <div className="relative z-10 w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 bg-blue-100 text-blue-600">
            <Plus size={20} />
          </div>
          <div className="flex-1">
            <div className="bg-card border-2 border-primary rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h5 className="font-semibold text-gray-900 text-sm">Nova Interação</h5>
                <button
                  onClick={handleCancel}
                  className="p-1 hover:bg-gray-100 rounded-md transition-colors"
                  aria-label="Cancelar"
                >
                  <X size={16} className="text-gray-600" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="interaction-type" className="text-xs font-medium mb-1 block">
                    Tipo de Interação
                  </Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, type: value as Interaction['type'] })
                    }
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="note">Nota</SelectItem>
                      <SelectItem value="call">Chamada</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="meeting">Reunião</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="interaction-content" className="text-xs font-medium mb-1 block">
                    {formData.type === 'note' && 'Nota'}
                    {formData.type === 'call' && 'Detalhes da Chamada'}
                    {formData.type === 'email' && 'Conteúdo do E-mail'}
                    {formData.type === 'whatsapp' && 'Mensagem'}
                    {formData.type === 'meeting' && 'Resumo da Reunião'}
                  </Label>
                  <Textarea
                    id="interaction-content"
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder={
                      formData.type === 'note'
                        ? 'Adicione uma nota sobre este lead...'
                        : formData.type === 'call'
                          ? 'Descreva o que foi discutido na chamada...'
                          : formData.type === 'email'
                            ? 'Conteúdo do e-mail enviado ou recebido...'
                            : formData.type === 'whatsapp'
                              ? 'Mensagem enviada ou recebida...'
                              : 'Resumo do que foi discutido na reunião...'
                    }
                    rows={3}
                    className="resize-none text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="custom-date" className="text-xs font-medium mb-1 block">
                      Data (opcional)
                    </Label>
                    <Input
                      id="custom-date"
                      type="date"
                      value={formData.customDate}
                      onChange={(e) => setFormData({ ...formData, customDate: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="custom-time" className="text-xs font-medium mb-1 block">
                      Hora (opcional)
                    </Label>
                    <Input
                      id="custom-time"
                      type="time"
                      value={formData.customTime}
                      onChange={(e) => setFormData({ ...formData, customTime: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={handleCancel} className="h-8 text-sm px-3">
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSave}
                    className="bg-primary hover:bg-primary-dark h-8 text-sm px-3"
                  >
                    Salvar Interação
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="relative">
        {/* Linha vertical */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-300" />

        <div className="space-y-6">
          {interactions.map((interaction) => {
            const Icon = getInteractionIcon(interaction.type);
            const colorClass = getInteractionColor(interaction.type);
            const label = getInteractionLabel(interaction.type);

            return (
              <div key={interaction.id} className="relative flex gap-4">
                {/* Ícone */}
                <div
                  className={`
                    relative z-10 w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0
                    ${colorClass}
                  `}
                >
                  <Icon size={20} />
                </div>

                {/* Conteúdo */}
                <div className="flex-1 pb-6">
                  <div className="bg-card border border-gray-300 rounded-lg p-4 shadow-sm">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-600">{label}</span>
                        <span className="text-xs text-gray-400">
                          {formatRelativeTime(interaction.timestamp)}
                        </span>
                      </div>
                      <button
                        onClick={() => setDeletingId(interaction.id)}
                        className="p-2 hover:bg-red-50 rounded-md transition-all duration-200 hover:scale-105 active:scale-95 border border-transparent hover:border-red-200"
                        aria-label="Deletar interação"
                        title="Deletar interação"
                      >
                        <Trash2 size={16} className="text-red-600" />
                      </button>
                    </div>
                    {isRichHtml(interaction.content) ? (
                      <div
                        className="text-sm text-foreground [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:ml-5 [&_ol]:ml-5 [&_a]:text-primary [&_a]:underline [&_p]:my-1"
                        dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(interaction.content) }}
                      />
                    ) : (
                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {interaction.content}
                      </p>
                    )}
                    {interaction.metadata && Object.keys(interaction.metadata).length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-300">
                        <div className="text-xs text-gray-600 space-y-1">
                          {Object.entries(interaction.metadata).map(([key, value]) => (
                            <div key={key}>
                              <span className="font-medium">{key}:</span> {String(value)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar esta interação? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingId) {
                  onDelete(deletingId);
                  setDeletingId(null);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
