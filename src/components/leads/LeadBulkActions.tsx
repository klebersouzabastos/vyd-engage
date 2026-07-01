import { Button } from '../ui/button';
import { X, ChevronDown, Tag, Download, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import type { Tag as TagType } from '../../types';

interface LeadBulkActionsProps {
  selectedCount: number;
  tags: TagType[];
  onClearSelection: () => void;
  onChangeStatus: (status: string) => void;
  onAddTag: (tagId: string) => void;
  onExportCSV: () => void;
  onDelete: () => void;
}

export function LeadBulkActions({
  selectedCount,
  tags,
  onClearSelection,
  onChangeStatus,
  onAddTag,
  onExportCSV,
  onDelete,
}: LeadBulkActionsProps) {
  return (
    <div
      className="bg-primary text-white rounded-lg p-4 shadow-sm border border-primary mb-4"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="font-medium">
            {selectedCount} lead{selectedCount > 1 ? 's' : ''} selecionado
            {selectedCount > 1 ? 's' : ''}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            className="text-white hover:bg-card/20 h-8 px-2"
          >
            <X size={14} />
          </Button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm" className="gap-1">
                Status <ChevronDown size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onChangeStatus('NEW')}>Novo</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onChangeStatus('CONTACTED')}>
                Contatado
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onChangeStatus('QUALIFIED')}>
                Qualificado
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onChangeStatus('PROPOSAL')}>
                Proposta
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onChangeStatus('NEGOTIATION')}>
                Negociacao
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onChangeStatus('WON')}>Ganho</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onChangeStatus('LOST')}>Perdido</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Tag Dropdown */}
          {tags.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="gap-1">
                  <Tag size={14} /> Tag <ChevronDown size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {tags.map((tag) => (
                  <DropdownMenuItem key={tag.id} onClick={() => onAddTag(tag.id)}>
                    <span
                      className="inline-block w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Export CSV */}
          <Button variant="secondary" size="sm" className="gap-1" onClick={onExportCSV}>
            <Download size={14} /> Exportar CSV
          </Button>

          {/* Delete */}
          <Button
            variant="destructive"
            size="sm"
            onClick={onDelete}
            className="bg-red-600 hover:bg-red-700 gap-1"
          >
            <Trash2 size={14} />
            Deletar
          </Button>
        </div>
      </div>
    </div>
  );
}
