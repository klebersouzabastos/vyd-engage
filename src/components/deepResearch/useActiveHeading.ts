import { useEffect, useState } from 'react';

/**
 * Scroll-spy: retorna o id da seção ativa conforme o usuário rola, para
 * destacar o item correspondente no sumário. Escolhe o último título acima do
 * offset do topo e, ao chegar ao fim da página, força a última seção (garante
 * que seções curtas no final também acendam).
 */
export function useActiveHeading(ids: string[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(ids[0] ?? null);
  const key = ids.join('|');

  useEffect(() => {
    if (!ids.length) return;

    const OFFSET = 120; // px abaixo do topo (compensa o cabeçalho)

    const compute = () => {
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top - OFFSET <= 0) {
          current = id;
        }
      }
      // Fim da página: ativa explicitamente a última seção.
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (atBottom) current = ids[ids.length - 1];

      setActiveId(current);
    };

    compute();
    window.addEventListener('scroll', compute, { passive: true });
    window.addEventListener('resize', compute);
    return () => {
      window.removeEventListener('scroll', compute);
      window.removeEventListener('resize', compute);
    };
    // key resume os ids para reagir quando o conjunto muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return activeId;
}
