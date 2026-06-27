import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ArrowRight } from 'lucide-react';

/** A target field a file column can be mapped to. */
export interface MappingTarget {
  /** Value sent to the backend mapping JSON (e.g. "email" or "cf_<id>"). */
  value: string;
  /** Human-readable label shown in the dropdown. */
  label: string;
}

/** Sentinel value for "do not import this column". */
export const IGNORE_VALUE = '__ignore__';

interface ColumnMapperProps {
  /** Column headers detected in the uploaded file. */
  fileColumns: string[];
  /** Available VYD target fields (built by the page, includes custom fields). */
  targets: MappingTarget[];
  /** Current mapping: fileColumn -> target value. */
  mapping: Record<string, string>;
  onChange: (fileColumn: string, targetValue: string) => void;
}

/**
 * Mapping table that associates each column of the uploaded file with a VYD
 * target field. One row per file column with a dropdown of target fields. The
 * "Não importar" option lets the user skip a column.
 */
export function ColumnMapper({ fileColumns, targets, mapping, onChange }: ColumnMapperProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-300 overflow-hidden">
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase">
        <span>Coluna do arquivo</span>
        <span className="px-2" aria-hidden="true" />
        <span>Campo do VYD</span>
      </div>
      <div className="divide-y divide-gray-100">
        {fileColumns.map((column) => (
          <div key={column} className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center px-4 py-3">
            <span className="font-mono text-sm text-gray-900 truncate" title={column}>
              {column || <span className="italic text-gray-400">(sem nome)</span>}
            </span>
            <ArrowRight size={16} className="text-gray-300 mx-2" />
            <Select
              value={mapping[column] || IGNORE_VALUE}
              onValueChange={(value) => onChange(column, value)}
            >
              <SelectTrigger aria-label={`Mapear coluna ${column}`}>
                <SelectValue placeholder="Não importar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={IGNORE_VALUE}>Não importar</SelectItem>
                {targets.map((target) => (
                  <SelectItem key={target.value} value={target.value}>
                    {target.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </div>
  );
}
