import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { Users, FileText, CheckSquare, MessageSquare, GitBranch, Search } from "lucide-react";
import { apiClient } from "../services/api/client";

interface SearchResult {
  id: string;
  type: "lead" | "task" | "interaction";
  title: string;
  subtitle?: string;
  icon: any;
  link: string;
}

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const performSearch = async (searchQuery: string) => {
      if (!searchQuery.trim()) return;
      const searchResults: SearchResult[] = [];

      try {
        // Buscar leads
        const leadsResult = await apiClient.getLeads({ limit: 100, search: query });
        const leads = leadsResult.leads || [];
        
        leads.forEach((lead: any) => {
          searchResults.push({
            id: `lead-${lead.id}`,
            type: "lead",
            title: lead.name,
            subtitle: `${lead.email || ''} • ${lead.phone || ''}`,
            icon: Users,
            link: `/app/leads`,
          });
        });

        // Buscar tarefas
        const tasksResult = await apiClient.getTasks({ limit: 100 });
        const tasks = tasksResult.tasks || [];
        const filteredTasks = tasks.filter(
          (task: any) =>
            task.title.toLowerCase().includes(query.toLowerCase()) ||
            task.description?.toLowerCase().includes(query.toLowerCase())
        );

        filteredTasks.forEach((task: any) => {
          searchResults.push({
            id: `task-${task.id}`,
            type: "task",
            title: task.title,
            subtitle: task.description || "Sem descrição",
            icon: CheckSquare,
            link: `/app/tasks`,
          });
        });

        // Buscar interações (limitado a 5)
        try {
          const interactionsResult = await apiClient.getInteractions({ limit: 100 });
          const interactions = Array.isArray(interactionsResult) ? interactionsResult : (interactionsResult.interactions || []);
          const filteredInteractions = interactions.filter(
            (interaction: any) =>
              interaction.content?.toLowerCase().includes(query.toLowerCase())
          );

          filteredInteractions.slice(0, 5).forEach((interaction: any) => {
            searchResults.push({
              id: `interaction-${interaction.id}`,
              type: "interaction",
              title: (interaction.content || '').substring(0, 50) + ((interaction.content || '').length > 50 ? "..." : ""),
              subtitle: `Lead ID: ${interaction.leadId}`,
              icon: MessageSquare,
              link: `/app/leads`,
            });
          });
        } catch (error) {
          console.error("Erro ao buscar interações:", error);
        }
      } catch (error) {
        console.error("Erro ao buscar:", error);
      }

      setResults(searchResults);
    };

    const debounceTimer = setTimeout(() => performSearch(query), 300);
    return () => clearTimeout(debounceTimer);
  }, [query]);

  const handleSelect = (result: SearchResult) => {
    navigate(result.link);
    setQuery("");
    setIsFocused(false);
    inputRef.current?.blur();
  };

  return (
    <div ref={containerRef} className="relative min-w-[280px]">
      <div
        className={`flex items-center gap-3 px-4 py-2.5 text-sm bg-gray-100 border rounded-lg transition-all duration-200 ${
          isFocused
            ? "bg-white border-primary shadow-md ring-2 ring-primary ring-offset-1"
            : "border-gray-300 hover:bg-white hover:border-[#D1D5DB] hover:shadow-sm"
        }`}
      >
        <Search size={18} className="text-gray-400 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder="Buscar leads, tarefas, interações..."
          className="flex-1 bg-transparent outline-none text-gray-900 placeholder:text-gray-600"
        />
        <kbd className="pointer-events-none inline-flex h-6 select-none items-center gap-1 rounded border border-[#D1D5DB] bg-white px-2 font-mono text-[11px] font-medium text-gray-600 shadow-sm">
          <span className="text-xs">⌘</span>K
        </kbd>
      </div>

      {isFocused && (query.trim() || results.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-[400px] overflow-hidden">
          <div className="max-h-[400px] overflow-y-auto">
            {results.length === 0 && query.trim() ? (
              <div className="px-4 py-6 text-center text-sm text-gray-600">
                Nenhum resultado encontrado.
              </div>
            ) : results.length > 0 ? (
              <div className="p-2">
                <div className="px-2 py-1.5 text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Resultados
                </div>
                {results.map((result) => {
                  const Icon = result.icon;
                  return (
                    <button
                      key={result.id}
                      onClick={() => handleSelect(result)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-gray-100 transition-colors text-left"
                    >
                      <Icon size={16} className="text-gray-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {result.title}
                        </p>
                        {result.subtitle && (
                          <p className="text-xs text-gray-600 truncate mt-0.5">
                            {result.subtitle}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 capitalize shrink-0">
                        {result.type === "lead"
                          ? "Lead"
                          : result.type === "task"
                          ? "Tarefa"
                          : "Interação"}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

