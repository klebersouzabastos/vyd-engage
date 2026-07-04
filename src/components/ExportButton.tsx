import { useState } from 'react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Download, ChevronDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { extractPendingApprovalFromBlob, notifyPendingApproval } from '../lib/approvalResponse';

type ExportFormat = 'json' | 'csv' | 'xlsx';

interface ExportButtonProps {
  /** Called with the selected format. Should return a Blob. */
  onExport: (format: ExportFormat) => Promise<Blob>;
  /** Base filename without extension (e.g. "leads-export") */
  filename?: string;
  /** Button label */
  label?: string;
  /** Variant */
  variant?: 'outline' | 'default' | 'ghost';
  /** Additional class names */
  className?: string;
}

const FORMAT_OPTIONS: { value: ExportFormat; label: string; ext: string; mime: string }[] = [
  { value: 'csv', label: 'CSV', ext: 'csv', mime: 'text/csv' },
  {
    value: 'xlsx',
    label: 'Excel (XLSX)',
    ext: 'xlsx',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  { value: 'json', label: 'JSON', ext: 'json', mime: 'application/json' },
];

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

export function ExportButton({
  onExport,
  filename = 'export',
  label = 'Exportar',
  variant = 'outline',
  className = '',
}: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async (format: ExportFormat) => {
    setLoading(true);
    try {
      const blob = await onExport(format);
      // Se o perfil do usuário exige aprovação, o backend responde 202 e o "blob"
      // carrega o envelope de aprovação em vez do arquivo. Nesse caso, informa que
      // foi enviado para aprovação e NÃO baixa nada.
      const pending = await extractPendingApprovalFromBlob(blob);
      if (pending) {
        notifyPendingApproval();
        return;
      }
      const opt = FORMAT_OPTIONS.find((o) => o.value === format)!;
      const dateStr = new Date().toISOString().slice(0, 10);
      triggerDownload(blob, `${filename}-${dateStr}.${opt.ext}`);
      toast.success(`Export concluido com sucesso`);
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(error?.message || 'Erro ao exportar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} className={`gap-2 ${className}`} disabled={loading}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {label}
          <ChevronDown size={14} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {FORMAT_OPTIONS.map((opt) => (
          <DropdownMenuItem key={opt.value} onClick={() => handleExport(opt.value)}>
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
