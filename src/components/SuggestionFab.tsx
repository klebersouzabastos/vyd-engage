import { useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { SuggestionDialog } from './SuggestionDialog';

/**
 * Botão flutuante global (montado no AppLayout) para enviar uma sugestão de
 * qualquer página. Abre o SuggestionDialog com a rota atual pré-preenchida.
 */
export function SuggestionFab() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Enviar sugestão"
        title="Enviar sugestão"
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-white shadow-lg hover:opacity-90 transition-opacity"
      >
        <MessageSquarePlus size={20} />
        <span className="hidden md:block text-sm font-medium">Sugestão</span>
      </button>
      <SuggestionDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
