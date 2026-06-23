import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { User } from 'lucide-react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useCommandPalette, type PaletteItem } from '@/hooks/useCommandPalette'
import { apiClient } from '@/services/api/client'

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

export function CommandPalette() {
  const { open, setOpen, query, setQuery, filteredStaticItems, recentItems, execute } =
    useCommandPalette()
  const navigate = useNavigate()
  const debouncedQuery = useDebounce(query, 300)

  const { data: leadResults } = useQuery({
    queryKey: ['cmd-palette-leads', debouncedQuery],
    queryFn: () => apiClient.getLeads({ search: debouncedQuery, limit: 5 }),
    enabled: debouncedQuery.length > 2 && open,
    staleTime: 10_000,
  })

  const leads = (leadResults as any)?.leads ?? []

  const showRecent = query.length === 0 && recentItems.length > 0
  const contextualItems = filteredStaticItems.filter((i) => i.group === 'contextual')
  const navItems = filteredStaticItems.filter((i) => i.group === 'navigation')
  const hasContent =
    showRecent ||
    leads.length > 0 ||
    contextualItems.length > 0 ||
    navItems.length > 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 max-w-[560px] gap-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Command Palette</DialogTitle>
          <DialogDescription>Pesquise ações e navegue pelo sistema com Ctrl+K</DialogDescription>
        </DialogHeader>
        <Command
          shouldFilter={false}
          className="[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-input]]:h-12"
        >
          <CommandInput
            placeholder="Pesquisar ações ou leads..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {!hasContent && (
              <CommandEmpty>
                {query ? `Nenhum resultado para "${query}"` : 'Digite para pesquisar...'}
              </CommandEmpty>
            )}

            {showRecent && (
              <>
                <CommandGroup heading="Recentes">
                  {recentItems.map((item: PaletteItem) => (
                    <CommandItem key={item.id} value={item.id} onSelect={() => execute(item)}>
                      <item.icon className="mr-2 h-4 w-4 shrink-0" />
                      {item.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {leads.length > 0 && (
              <>
                <CommandGroup heading="Leads">
                  {leads.map((lead: any) => (
                    <CommandItem
                      key={lead.id}
                      value={`lead-${lead.id}`}
                      onSelect={() => {
                        setOpen(false)
                        navigate(`/app/leads/${lead.id}`)
                      }}
                    >
                      <User className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">{lead.name}</span>
                        {lead.company && (
                          <span className="text-xs text-muted-foreground truncate">
                            {lead.company}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {contextualItems.length > 0 && (
              <>
                <CommandGroup heading="Ações desta página">
                  {contextualItems.map((item: PaletteItem) => (
                    <CommandItem
                      key={item.id}
                      value={item.id}
                      onSelect={() => execute(item)}
                    >
                      <item.icon className="mr-2 h-4 w-4 shrink-0" />
                      {item.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {navItems.length > 0 && (
              <CommandGroup heading="Navegar">
                {navItems.map((item: PaletteItem) => (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={() => execute(item)}
                  >
                    <item.icon className="mr-2 h-4 w-4 shrink-0" />
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
