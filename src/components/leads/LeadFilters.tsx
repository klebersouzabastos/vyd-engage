import { useNavigate } from "react-router";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Plus, Download, Upload, Copy, ChevronDown } from "lucide-react";
import { FilterPopover } from "./FilterPopover";
import { CustomFieldsFilter } from "./CustomFieldsFilter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import type { Tag, CustomField } from "../../types";

interface Automation {
  id: number;
  name: string;
  type: "whatsapp" | "email";
  status: "active" | "paused";
}

interface LeadFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterStatus: string[];
  onFilterStatusChange: (status: string[]) => void;
  filterSource: string[];
  onFilterSourceChange: (source: string[]) => void;
  filterAutomation: string[];
  onFilterAutomationChange: (automation: string[]) => void;
  filterTag: string[];
  onFilterTagChange: (tag: string[]) => void;
  filterCustomFields: Record<string, any>;
  onFilterCustomFieldsChange: (fields: Record<string, any>) => void;
  tags: Tag[];
  customFields: CustomField[];
  availableAutomations: Automation[];
  onImportClick: () => void;
  onExportCurrentPage: () => void;
  onExportAllFiltered: () => void;
}

export function LeadFilters({
  searchQuery,
  onSearchChange,
  filterStatus,
  onFilterStatusChange,
  filterSource,
  onFilterSourceChange,
  filterAutomation,
  onFilterAutomationChange,
  filterTag,
  onFilterTagChange,
  filterCustomFields,
  onFilterCustomFieldsChange,
  tags,
  customFields,
  availableAutomations,
  onImportClick,
  onExportCurrentPage,
  onExportAllFiltered,
}: LeadFiltersProps) {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-lg p-3 md:p-4 shadow-sm border border-gray-300 mb-4 md:mb-6">
      <div className="flex flex-wrap items-center gap-2 md:gap-4">
        <div className="flex-1 min-w-[160px] md:min-w-[200px] w-full md:w-auto">
          <Input
            placeholder="Buscar por nome, telefone ou e-mail..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Buscar leads por nome, telefone ou e-mail"
          />
        </div>

        <FilterPopover
          filterId="status"
          label="Filtrar por Status"
          allLabel="Todos os status"
          countSuffix="status"
          options={[
            { value: "novo", label: "Novo" },
            { value: "contato", label: "Em Contato" },
            { value: "fechado", label: "Fechado" },
            { value: "perdido", label: "Perdido" },
          ]}
          selected={filterStatus}
          onChange={onFilterStatusChange}
        />

        <FilterPopover
          filterId="source"
          label="Filtrar por Origem"
          allLabel="Todas as origens"
          countSuffix="origem(s)"
          options={[
            { value: "meta", label: "Meta Ads" },
            { value: "google", label: "Google Ads" },
            { value: "organico", label: "Orgânico" },
            { value: "manual", label: "Manual" },
          ]}
          selected={filterSource}
          onChange={onFilterSourceChange}
        />

        <FilterPopover
          filterId="automation"
          label="Filtrar por Automação"
          allLabel="Todas as automações"
          countSuffix="automação(ões)"
          options={[
            { value: "with", label: "Com automações" },
            { value: "without", label: "Sem automações" },
            ...availableAutomations.map(a => ({ value: a.id.toString(), label: a.name }))
          ]}
          selected={filterAutomation}
          onChange={onFilterAutomationChange}
          showSelectAll={false}
        />

        <FilterPopover
          filterId="tag"
          label="Filtrar por Tag"
          allLabel="Todas as tags"
          countSuffix="tag(s)"
          options={tags.map(t => ({ value: t.id, label: t.name }))}
          selected={filterTag}
          onChange={onFilterTagChange}
        />

        <CustomFieldsFilter
          customFields={customFields}
          filterCustomFields={filterCustomFields}
          onFilterChange={onFilterCustomFieldsChange}
        />

        <Button variant="outline" className="gap-2" onClick={() => navigate("/app/leads/duplicates")}>
          <Copy size={16} />
          Duplicados
        </Button>

        <Button variant="outline" className="gap-2" onClick={onImportClick}>
          <Upload size={16} />
          Importar
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Download size={16} />
              Exportar
              <ChevronDown size={14} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onExportCurrentPage}>
              Exportar Pagina Atual
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExportAllFiltered}>
              Exportar Todos (Filtrados)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          className="bg-primary hover:bg-primary-dark gap-2"
          onClick={() => navigate("/app/leads/new")}
          data-tour="create-lead-btn"
        >
          <Plus size={16} />
          Novo Lead
        </Button>
      </div>
    </div>
  );
}
