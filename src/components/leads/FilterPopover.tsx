import { useState, useRef, useEffect, ReactNode } from 'react';
import { Button, buttonVariants } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Filter, ChevronDown } from 'lucide-react';
import { cn } from '../ui/utils';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterPopoverProps {
  filterId: string;
  label: string;
  allLabel: string;
  countSuffix: string;
  options: FilterOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  showSelectAll?: boolean;
}

export function FilterPopover({
  filterId,
  label,
  allLabel,
  countSuffix,
  options,
  selected,
  onChange,
  showSelectAll = true,
}: FilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (ref.current && !ref.current.contains(target)) {
        const button = target.closest(`button[data-filter="${filterId}"]`);
        if (!button) setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, filterId]);

  const displayText =
    selected.length === 0 || selected.length === options.length
      ? allLabel
      : `${selected.length} ${countSuffix}`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        data-filter={filterId}
        className={cn(
          buttonVariants({ variant: 'outline' }),
          'gap-2 border border-gray-300 bg-card hover:bg-gray-50 cursor-pointer'
        )}
        onClick={() => setOpen(!open)}
      >
        <Filter size={16} />
        <span>{displayText}</span>
        <ChevronDown
          size={16}
          className={
            open
              ? 'rotate-180 transition-transform duration-200'
              : 'transition-transform duration-200'
          }
        />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-2 z-50 w-56 bg-card rounded-md border border-gray-300 shadow-lg p-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-300">
              <span className="text-sm font-medium text-gray-900">{label}</span>
              {showSelectAll && options.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (selected.length === options.length) {
                      onChange([]);
                    } else {
                      onChange(options.map((o) => o.value));
                    }
                  }}
                  className="h-6 px-2 text-xs"
                >
                  {selected.length === options.length ? 'Desmarcar' : 'Selecionar todos'}
                </Button>
              )}
            </div>
            {options.length > 0 ? (
              options.map((option) => {
                const isChecked = selected.includes(option.value);
                const handleToggle = () => {
                  if (isChecked) {
                    onChange(selected.filter((s) => s !== option.value));
                  } else {
                    onChange([...selected, option.value]);
                  }
                };
                return (
                  <div
                    key={option.value}
                    role="button"
                    tabIndex={0}
                    className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded-md -mx-2"
                    onClick={(e) => {
                      e.preventDefault();
                      handleToggle();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleToggle();
                      }
                    }}
                  >
                    <Checkbox
                      id={`${filterId}-${option.value}`}
                      checked={isChecked}
                      onCheckedChange={handleToggle}
                      onClick={(e) => e.stopPropagation()}
                    />
                    {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events -- o onClick com preventDefault evita o duplo-toggle do label nativo; a acessibilidade por teclado vem do Checkbox associado via htmlFor */}
                    <label
                      htmlFor={`${filterId}-${option.value}`}
                      className="text-sm text-gray-900 cursor-pointer flex-1"
                      onClick={(e) => {
                        e.preventDefault();
                        handleToggle();
                      }}
                    >
                      {option.label}
                    </label>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-gray-600 p-2">Nenhuma opcao disponivel</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
