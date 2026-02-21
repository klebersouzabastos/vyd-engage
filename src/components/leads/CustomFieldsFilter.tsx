import { useState, useRef, useEffect } from "react";
import { Button, buttonVariants } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Checkbox } from "../ui/checkbox";
import { Filter, ChevronDown } from "lucide-react";
import { cn } from "../ui/utils";
import { CustomField } from "../../types";

interface CustomFieldsFilterProps {
  customFields: CustomField[];
  filterCustomFields: Record<string, string | number | boolean | null>;
  onFilterChange: (fields: Record<string, string | number | boolean | null>) => void;
}

export function CustomFieldsFilter({ customFields, filterCustomFields, onFilterChange }: CustomFieldsFilterProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (ref.current && !ref.current.contains(target)) {
        const button = target.closest('button[data-filter="customFields"]');
        if (!button) setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (customFields.length === 0) return null;

  const activeCount = Object.keys(filterCustomFields).filter(
    k => filterCustomFields[k] !== null && filterCustomFields[k] !== undefined && filterCustomFields[k] !== ""
  ).length;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        data-filter="customFields"
        className={cn(
          buttonVariants({ variant: "outline" }),
          "gap-2 border border-gray-300 bg-white hover:bg-gray-50 cursor-pointer"
        )}
        onClick={() => setOpen(!open)}
      >
        <Filter size={16} />
        <span>
          {activeCount === 0 ? "Campos Customizados" : `${activeCount} campo(s)`}
        </span>
        <ChevronDown size={16} className={open ? "rotate-180 transition-transform duration-200" : "transition-transform duration-200"} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-2 z-50 w-80 bg-white rounded-md border border-gray-300 shadow-lg p-4 max-h-96 overflow-y-auto">
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-300">
              <span className="text-sm font-medium text-gray-900">Filtrar por Campos Customizados</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onFilterChange({})}
                className="h-6 px-2 text-xs"
              >
                Limpar
              </Button>
            </div>
            {customFields.map((field) => {
              const currentValue = filterCustomFields[field.id] || "";
              return (
                <div key={field.id} className="space-y-2">
                  <Label className="text-xs font-medium text-gray-600">{field.name}</Label>
                  {field.type === "text" || field.type === "textarea" ? (
                    <Input
                      value={currentValue}
                      onChange={(e) => onFilterChange({ ...filterCustomFields, [field.id]: e.target.value || null })}
                      placeholder={`Filtrar por ${field.name.toLowerCase()}...`}
                      className="h-8 text-sm"
                    />
                  ) : field.type === "number" ? (
                    <Input
                      type="number"
                      value={currentValue}
                      onChange={(e) => onFilterChange({ ...filterCustomFields, [field.id]: e.target.value ? Number(e.target.value) : null })}
                      placeholder={`Filtrar por ${field.name.toLowerCase()}...`}
                      className="h-8 text-sm"
                    />
                  ) : field.type === "date" ? (
                    <Input
                      type="date"
                      value={currentValue}
                      onChange={(e) => onFilterChange({ ...filterCustomFields, [field.id]: e.target.value || null })}
                      className="h-8 text-sm"
                    />
                  ) : field.type === "select" && field.options ? (
                    <select
                      value={currentValue}
                      onChange={(e) => onFilterChange({ ...filterCustomFields, [field.id]: e.target.value || null })}
                      className="w-full h-8 text-sm border border-gray-300 rounded-md px-2"
                    >
                      <option value="">Todos</option>
                      {field.options.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  ) : field.type === "checkbox" ? (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={currentValue === true}
                        onCheckedChange={(checked) => onFilterChange({ ...filterCustomFields, [field.id]: checked ? true : null })}
                      />
                      <Label className="text-sm">Sim</Label>
                      <Checkbox
                        checked={currentValue === false}
                        onCheckedChange={(checked) => onFilterChange({ ...filterCustomFields, [field.id]: checked ? false : null })}
                      />
                      <Label className="text-sm">Não</Label>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
