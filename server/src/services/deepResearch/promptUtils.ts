// Utilitários de prompt (server-side). O prompt é IP da plataforma: a montagem
// do prompt final acontece aqui (não no frontend), e dele derivamos o que o
// usuário comum pode ver — os campos a preencher (placeholders) e o resumo do
// que será entregue (outline de capítulos) — SEM expor o texto do prompt.

function placeholderRegex(): RegExp {
  return /\[([^\]\n]{1,60})\](?!\()/g;
}

/** Placeholders [TEXTO] do template, na ordem de aparição e sem repetir. */
export function extractPlaceholders(promptBody: string): string[] {
  const re = placeholderRegex();
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(promptBody || '')) !== null) {
    const key = m[1].trim();
    if (!/[a-zA-ZÀ-ÿ]/.test(key)) continue;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  }
  return out;
}

/** Substitui os placeholders pelos valores; mantém o original quando vazio. */
export function applyPlaceholders(promptBody: string, values: Record<string, string>): string {
  return (promptBody || '').replace(placeholderRegex(), (full, rawKey: string) => {
    const value = values[rawKey.trim()];
    return value && value.trim() ? value : full;
  });
}

/**
 * Resumo do que será entregue, derivado dos títulos de capítulo (## / ###) do
 * prompt — sem revelar o conteúdo do prompt. Pula seções estruturais
 * (objetivo, estrutura, instruções, fontes) e limpa o prefixo "Capítulo N —".
 */
export function extractOutline(promptBody: string): string[] {
  const items: string[] = [];
  for (const line of (promptBody || '').split('\n')) {
    const m = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    let title = m[2].replace(/[*_`]/g, '').trim();
    if (/^(objetivo|estrutura|instru[çc]|formata|fontes|refer)/i.test(title)) continue;
    title = title.replace(/^cap[íi]tulo\s+\d+\s*[—:-]\s*/i, '').trim();
    if (title) items.push(title);
  }
  return items;
}

/**
 * Monta o prompt final a partir do template + valores preenchidos + um eventual
 * contexto adicional informado pelo usuário (enriquecimento). Tudo no servidor.
 */
export function buildPrompt(
  promptBody: string,
  variables: Record<string, string>,
  extraContext?: string
): string {
  let prompt = applyPlaceholders(promptBody, variables);
  const extra = (extraContext || '').trim();
  if (extra) {
    prompt += `\n\n## Contexto adicional informado\n${extra}`;
  }
  return prompt;
}
