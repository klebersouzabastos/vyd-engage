import { Sparkles, ArrowRight } from 'lucide-react';
import { useCompany } from '../../contexts/CompanyContext';

interface ReportCoverProps {
  title: string;
  /** Títulos das seções para "O que este relatório aborda". */
  sectionTitles: string[];
  templateName: string | null;
  updatedAt: string;
  /** 'full' = página 0 do modo Apresentação; 'compact' = faixa no topo da Leitura. */
  variant: 'full' | 'compact';
  /** CTA "Começar" (apenas na variante 'full'). */
  onStart?: () => void;
}

function monogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Capa do relatório com a identidade da empresa logada (tenant). Variante 'full'
 * abre a apresentação (título, sumário do que será abordado, CTA); 'compact' é
 * uma faixa de cabeçalho no topo do modo Leitura.
 */
export function ReportCover({
  title,
  sectionTitles,
  templateName,
  updatedAt,
  variant,
  onStart,
}: ReportCoverProps) {
  const { companyName, logo } = useCompany();
  const date = new Date(updatedAt).toLocaleDateString('pt-BR');

  const brand = (
    <div className="report-cover__brand">
      {logo ? (
        <img src={logo} alt={companyName} className="report-cover__logo" />
      ) : (
        <span className="report-cover__monogram" aria-hidden>
          {monogram(companyName)}
        </span>
      )}
      <span className="report-cover__company">
        {companyName}
        <small>Inteligência de Mercado{templateName ? ` · ${templateName}` : ''}</small>
      </span>
    </div>
  );

  if (variant === 'compact') {
    return (
      <div className="report-cover report-cover--compact">
        {brand}
        <p className="report-cover__title">{title}</p>
        <span className="report-cover__meta" style={{ marginLeft: 'auto' }}>
          {date}
        </span>
      </div>
    );
  }

  return (
    <div className="report-cover report-cover--full">
      {brand}
      <span className="report-cover__badge">
        <Sparkles size={13} aria-hidden /> Inteligência de Mercado
      </span>
      <h1 className="report-cover__title">{title}</h1>
      <p className="report-cover__meta">
        {templateName ? `${templateName} · ` : ''}
        {date}
      </p>

      {sectionTitles.length > 0 && (
        <>
          <p className="report-cover__toc-title">O que este relatório aborda</p>
          <div className="report-cover__toc">
            {sectionTitles.map((t, i) => (
              <div key={`${t}-${i}`} className="report-cover__toc-item">
                <span className="report-cover__toc-num">{String(i + 1).padStart(2, '0')}</span>
                <span>{t}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {onStart && (
        <button type="button" className="report-cover__cta" onClick={onStart}>
          Começar a leitura <ArrowRight size={16} aria-hidden />
        </button>
      )}
    </div>
  );
}
