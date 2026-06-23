import { useState, useEffect, useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useAuth } from '@/contexts/AuthContext'
import {
  LayoutDashboard,
  Users,
  Briefcase,
  CheckSquare,
  BarChart2,
  Settings,
  Plus,
  Filter,
  Building2,
  type LucideIcon,
} from 'lucide-react'

export interface PaletteItem {
  id: string
  label: string
  icon: LucideIcon
  group: 'recent' | 'contextual' | 'navigation'
  action: () => void
  keywords?: string[]
}

const HISTORY_KEY_PREFIX = 'cmd_palette_history_'
const MAX_HISTORY = 5

// Module-level singleton so any component can open the palette
let _setOpen: ((v: boolean) => void) | null = null
export function openCommandPalette() {
  _setOpen?.(true)
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false)

  // Register this instance as the global handler
  useEffect(() => {
    _setOpen = setOpen
    return () => { _setOpen = null }
  }, [setOpen])
  const [query, setQuery] = useState('')
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()

  // Keyboard shortcut — Ctrl+K / ⌘K
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        const target = e.target as HTMLElement
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        ) {
          return
        }
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  // Reset query on close
  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const historyKey = user?.id ? `${HISTORY_KEY_PREFIX}${user.id}` : null

  const getHistory = useCallback((): string[] => {
    if (!historyKey) return []
    try {
      return JSON.parse(localStorage.getItem(historyKey) ?? '[]')
    } catch {
      return []
    }
  }, [historyKey])

  const addToHistory = useCallback(
    (id: string) => {
      if (!historyKey) return
      try {
        const next = [id, ...getHistory().filter((x) => x !== id)].slice(0, MAX_HISTORY)
        localStorage.setItem(historyKey, JSON.stringify(next))
      } catch {
        // ignore localStorage errors
      }
    },
    [historyKey, getHistory],
  )

  const execute = useCallback(
    (item: PaletteItem) => {
      addToHistory(item.id)
      setOpen(false)
      item.action()
    },
    [addToHistory],
  )

  const allStaticItems = useMemo((): PaletteItem[] => {
    const path = location.pathname

    const nav: PaletteItem[] = [
      {
        id: 'nav-dashboard',
        label: 'Ir para Dashboard',
        icon: LayoutDashboard,
        group: 'navigation',
        action: () => navigate('/app'),
        keywords: ['dashboard', 'início', 'home'],
      },
      {
        id: 'nav-leads',
        label: 'Ir para Leads',
        icon: Users,
        group: 'navigation',
        action: () => navigate('/app/leads'),
        keywords: ['leads', 'contatos'],
      },
      {
        id: 'nav-pipeline',
        label: 'Ir para Pipeline',
        icon: Briefcase,
        group: 'navigation',
        action: () => navigate('/app/pipeline'),
        keywords: ['pipeline', 'kanban', 'funil'],
      },
      {
        id: 'nav-deals',
        label: 'Ir para Deals',
        icon: Briefcase,
        group: 'navigation',
        action: () => navigate('/app/deals'),
        keywords: ['deals', 'negócios', 'oportunidades'],
      },
      {
        id: 'nav-tasks',
        label: 'Ir para Tarefas',
        icon: CheckSquare,
        group: 'navigation',
        action: () => navigate('/app/tasks'),
        keywords: ['tarefas', 'tasks', 'atividades'],
      },
      {
        id: 'nav-reports',
        label: 'Ir para Relatórios',
        icon: BarChart2,
        group: 'navigation',
        action: () => navigate('/app/reports'),
        keywords: ['relatórios', 'reports', 'analytics'],
      },
      {
        id: 'nav-companies',
        label: 'Ir para Empresas',
        icon: Building2,
        group: 'navigation',
        action: () => navigate('/app/companies'),
        keywords: ['empresas', 'companies', 'organizações'],
      },
      {
        id: 'nav-settings',
        label: 'Ir para Configurações',
        icon: Settings,
        group: 'navigation',
        action: () => navigate('/app/settings'),
        keywords: ['configurações', 'settings', 'conta'],
      },
    ]

    const contextual: PaletteItem[] = []

    if (path.includes('/leads')) {
      contextual.push(
        {
          id: 'ctx-new-lead',
          label: 'Novo Lead',
          icon: Plus,
          group: 'contextual',
          action: () => navigate('/app/leads/new'),
          keywords: ['criar lead', 'novo contato', 'adicionar'],
        },
        {
          id: 'ctx-filter-leads',
          label: 'Filtrar por responsável',
          icon: Filter,
          group: 'contextual',
          action: () => {},
          keywords: ['filtrar', 'responsável', 'buscar'],
        },
      )
    }

    if (path.includes('/pipeline') || path.includes('/deals')) {
      contextual.push({
        id: 'ctx-new-deal',
        label: 'Novo Deal',
        icon: Plus,
        group: 'contextual',
        action: () => navigate('/app/deals/new'),
        keywords: ['criar deal', 'novo negócio', 'oportunidade'],
      })
    }

    if (path.includes('/tasks')) {
      contextual.push({
        id: 'ctx-new-task',
        label: 'Nova Tarefa',
        icon: Plus,
        group: 'contextual',
        action: () => navigate('/app/tasks/new'),
        keywords: ['criar tarefa', 'nova atividade', 'adicionar'],
      })
    }

    return [...contextual, ...nav]
  }, [location.pathname, navigate])

  const recentItems = useMemo((): PaletteItem[] => {
    const history = getHistory()
    return history
      .map((id) => allStaticItems.find((item) => item.id === id))
      .filter((item): item is PaletteItem => Boolean(item))
  }, [getHistory, allStaticItems])

  // Filter static items by query (label + keywords)
  const filteredStaticItems = useMemo((): PaletteItem[] => {
    if (!query) return allStaticItems
    const q = query.toLowerCase()
    return allStaticItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.keywords?.some((k) => k.toLowerCase().includes(q)),
    )
  }, [allStaticItems, query])

  return {
    open,
    setOpen,
    query,
    setQuery,
    filteredStaticItems,
    recentItems,
    execute,
  }
}
