// Estrelas de qualificação da negociação (Upgrade RD P0, req 1).
// Read-only (card do kanban, coluna da lista) ou editável inline (DealDetail).
// Os NOMES dos níveis vêm da configuração do tenant (GET /sales-config/qualification).
import { useQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import type { QualificationConfig, QualificationLevel } from '../../types/sales';
import { cn } from '../ui/utils';

const DEFAULT_LEVEL_NAMES = ['Muito frio', 'Frio', 'Morno', 'Quente', 'Muito quente'];

/**
 * Config de qualificação do tenant, cacheada e compartilhada entre todos os
 * cards/listas (uma única request por sessão de 5 min via react-query).
 */
export function useQualificationConfig() {
  return useQuery<QualificationConfig | null>({
    queryKey: ['qualification-config'],
    queryFn: async () => {
      try {
        const res = await apiClient.getQualificationConfig();
        return res.data;
      } catch {
        // Config indisponível → usa nomes padrão (não bloqueia a UI).
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/** Nome do nível (1–5) conforme config do tenant, com fallback nos padrões. */
export function qualificationLevelName(
  levels: QualificationLevel[] | undefined,
  level: number
): string {
  const found = levels?.find((l) => l.level === level);
  return found?.name || DEFAULT_LEVEL_NAMES[level - 1] || `Nível ${level}`;
}

interface QualificationStarsProps {
  /** Qualificação atual (1–5) ou null/undefined (sem qualificação). */
  value: number | null | undefined;
  /** Níveis configurados do tenant (para o tooltip com o nome). */
  levels?: QualificationLevel[];
  /** Tamanho do ícone em px. */
  size?: number;
  /** Editável: clicar na estrela define o nível; clicar no nível atual limpa. */
  editable?: boolean;
  onChange?: (value: number | null) => void;
  className?: string;
}

export function QualificationStars({
  value,
  levels,
  size = 14,
  editable = false,
  onChange,
  className,
}: QualificationStarsProps) {
  const q = value ?? 0;

  if (!editable) {
    return (
      <div
        className={cn('flex items-center gap-0.5 text-warning', className)}
        title={
          q > 0 ? `Qualificação: ${qualificationLevelName(levels, q)}` : 'Sem qualificação'
        }
        aria-label={
          q > 0 ? `Qualificação: ${qualificationLevelName(levels, q)}` : 'Sem qualificação'
        }
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} size={size} fill={n <= q ? 'currentColor' : 'none'} aria-hidden="true" />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn('flex items-center gap-0.5', className)}
      role="radiogroup"
      aria-label="Qualificação da negociação"
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const name = qualificationLevelName(levels, n);
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={q === n}
            title={q === n ? `${name} — clique para remover` : name}
            aria-label={name}
            onClick={() => onChange?.(n === q ? null : n)}
            className="text-warning hover:opacity-80 transition-opacity p-0.5"
          >
            <Star size={size} fill={n <= q ? 'currentColor' : 'none'} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
