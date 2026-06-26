import { ExternalLink } from 'lucide-react';
import type { ResearchSource } from '../../types/deepResearch';

interface ReportSourcesProps {
  searchResults: ResearchSource[];
  sourceCount: number;
  /** true = página autônoma (modo Apresentação); false = rodapé no scroll. */
  asPage?: boolean;
}

/** Nome de host limpo (sem www) para usar como rótulo de uma fonte sem título. */
export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Bloco "Fontes" do relatório — reutilizado como página final (paginado) e como
 * rodapé (scroll). Quando há `searchResults`, lista títulos clicáveis (abrem em
 * nova aba) com data; senão, cai na contagem de citações.
 */
export function ReportSources({ searchResults, sourceCount, asPage = false }: ReportSourcesProps) {
  if (searchResults.length === 0 && sourceCount === 0) return null;

  const className = `report-sources ${asPage ? 'report-sources--page' : 'report-sources--inline'}`;

  if (searchResults.length === 0) {
    return (
      <section className={className}>
        <p className="report-sources__title">Fontes</p>
        <p style={{ fontSize: 13, color: 'var(--rv-faint)' }}>
          Relatório gerado com {sourceCount} citação(ões).
        </p>
      </section>
    );
  }

  return (
    <section className={className}>
      <p className="report-sources__title">Fontes ({searchResults.length})</p>
      <ol className="report-sources__list">
        {searchResults.map((s, i) => (
          <li key={`${s.url}-${i}`} className="report-sources__item">
            <span className="report-sources__num">{i + 1}.</span>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="report-sources__link"
            >
              <span>{s.title?.trim() || hostnameOf(s.url)}</span>
              <ExternalLink size={13} style={{ flex: 'none', alignSelf: 'center' }} aria-hidden />
            </a>
            {s.date && <span className="report-sources__date">{s.date}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
