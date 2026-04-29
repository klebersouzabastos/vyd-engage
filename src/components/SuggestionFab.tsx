import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { SuggestionDialog } from "./SuggestionDialog";

export function SuggestionFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Enviar sugestão"
        title="Enviar sugestão"
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-white shadow-lg hover:bg-primary-dark transition-colors"
      >
        <MessageSquarePlus size={20} />
        <span className="hidden sm:inline text-sm font-medium">Sugestão</span>
      </button>

      <SuggestionDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
