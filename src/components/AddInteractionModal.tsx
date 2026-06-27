import { useState } from 'react';
import { toast } from 'sonner';
import { Interaction } from '../types';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';

interface AddInteractionModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (interaction: Omit<Interaction, 'id' | 'leadId' | 'timestamp'>) => void;
  leadId: number;
}

export function AddInteractionModal({ open, onClose, onSave, leadId }: AddInteractionModalProps) {
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

    onSave({
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
    onClose();
  };

  const handleClose = () => {
    setFormData({
      type: 'note',
      content: '',
      customDate: '',
      customTime: '',
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="flex-shrink-0 px-4 pt-4 pb-2 border-b border-gray-300">
          <DialogTitle>Nova Interação</DialogTitle>
        </DialogHeader>

        {/* Conteúdo scrollável */}
        <div className="flex-1 overflow-y-auto min-h-0 px-4 py-3 space-y-2.5">
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
              rows={2}
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
        </div>

        {/* Footer */}
        <DialogFooter className="flex-shrink-0 px-4 pb-4 pt-2 border-t border-gray-300 mt-2">
          <Button variant="outline" onClick={handleClose} className="h-8 text-sm px-3">
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            className="bg-primary hover:bg-primary-dark h-8 text-sm px-3"
          >
            Salvar Interação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
