import { useEffect } from 'react';
import { Search } from 'lucide-react';
import { openCommandPalette } from '@/hooks/useCommandPalette';

export function GlobalSearch() {
  // Ctrl+K / ⌘K — delegate to CommandPalette
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        openCommandPalette();
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return (
    <button
      onClick={openCommandPalette}
      className="flex items-center gap-3 px-4 py-2.5 text-sm bg-gray-100 border border-gray-300 rounded-lg transition-all duration-200 hover:bg-white hover:border-gray-400 hover:shadow-sm min-w-[280px] text-left"
      aria-label="Abrir busca global (⌘K)"
    >
      <Search size={18} className="text-gray-400 shrink-0" />
      <span className="flex-1 text-gray-500">Buscar leads, tarefas, interações...</span>
      <kbd className="pointer-events-none inline-flex h-6 select-none items-center gap-1 rounded border border-gray-300 bg-white px-2 font-mono text-[11px] font-medium text-gray-600 shadow-sm">
        <span className="text-xs">⌘</span>K
      </kbd>
    </button>
  );
}
