import type { Components } from 'react-markdown';

/**
 * Mapa de componentes do react-markdown que estiliza cada elemento do relatorio
 * com um tema de "documento" profissional (paleta cinza/branco/azul-escuro).
 * Tudo determinístico via Tailwind — sem `prose` (o projeto é Tailwind v4 sem
 * @tailwindcss/typography) e sem geração externa. `node` é descartado para nao
 * vazar para o DOM.
 */
export const reportComponents: Components = {
  h1: ({ node, ...props }) => (
    // eslint-disable-next-line jsx-a11y/heading-has-content -- conteúdo vem via children/props do react-markdown
    <h1
      className="scroll-mt-24 mb-5 mt-2 text-[1.9rem] font-bold leading-tight tracking-tight text-slate-900"
      {...props}
    />
  ),
  h2: ({ node, ...props }) => (
    // eslint-disable-next-line jsx-a11y/heading-has-content -- conteúdo vem via children/props do react-markdown
    <h2
      className="scroll-mt-24 mt-12 mb-4 flex items-center gap-3 border-b border-slate-200 pb-2 text-2xl font-bold tracking-tight text-slate-900 before:h-6 before:w-1.5 before:rounded-full before:bg-primary before:content-['']"
      {...props}
    />
  ),
  h3: ({ node, ...props }) => (
    // eslint-disable-next-line jsx-a11y/heading-has-content -- conteúdo vem via children/props do react-markdown
    <h3 className="scroll-mt-24 mt-8 mb-2 text-lg font-semibold text-slate-800" {...props} />
  ),
  h4: ({ node, ...props }) => (
    // eslint-disable-next-line jsx-a11y/heading-has-content -- conteúdo vem via children/props do react-markdown
    <h4 className="scroll-mt-24 mt-5 mb-2 text-base font-semibold text-slate-800" {...props} />
  ),
  h5: ({ node, ...props }) => (
    // eslint-disable-next-line jsx-a11y/heading-has-content -- conteúdo vem via children/props do react-markdown
    <h5 className="scroll-mt-24 mt-4 mb-1 text-sm font-semibold text-slate-700" {...props} />
  ),
  h6: ({ node, ...props }) => (
    // eslint-disable-next-line jsx-a11y/heading-has-content -- conteúdo vem via children/props do react-markdown
    <h6
      className="scroll-mt-24 mt-3 mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500"
      {...props}
    />
  ),
  p: ({ node, ...props }) => (
    <p className="my-3.5 text-[0.95rem] leading-7 text-slate-700" {...props} />
  ),
  a: ({ node, ...props }) => (
    // eslint-disable-next-line jsx-a11y/anchor-has-content -- conteúdo vem via children/props do react-markdown
    <a
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="font-medium text-primary underline decoration-primary/30 underline-offset-2 transition-colors hover:decoration-primary"
      {...props}
    />
  ),
  ul: ({ node, ...props }) => (
    <ul
      className="my-4 list-disc space-y-1.5 pl-6 text-[0.95rem] text-slate-700 marker:text-primary/70"
      {...props}
    />
  ),
  ol: ({ node, ...props }) => (
    <ol
      className="my-4 list-decimal space-y-1.5 pl-6 text-[0.95rem] text-slate-700 marker:font-semibold marker:text-primary/80"
      {...props}
    />
  ),
  li: ({ node, ...props }) => <li className="pl-1 leading-7" {...props} />,
  blockquote: ({ node, ...props }) => (
    <blockquote
      className="my-5 rounded-r-lg border-l-4 border-primary bg-blue-50/70 px-5 py-3 text-[0.95rem] italic text-slate-700"
      {...props}
    />
  ),
  hr: ({ node, ...props }) => <hr className="my-10 border-slate-200" {...props} />,
  strong: ({ node, ...props }) => <strong className="font-semibold text-slate-900" {...props} />,
  em: ({ node, ...props }) => <em className="italic text-slate-700" {...props} />,
  img: ({ node, ...props }) => (
    // eslint-disable-next-line jsx-a11y/alt-text
    <img className="my-5 max-w-full rounded-lg border border-slate-200 shadow-sm" {...props} />
  ),
  table: ({ node, ...props }) => (
    <div className="my-6 overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
      <table className="w-full border-collapse text-left text-sm" {...props} />
    </div>
  ),
  thead: ({ node, ...props }) => <thead className="bg-slate-800" {...props} />,
  th: ({ node, ...props }) => (
    <th
      className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-100"
      {...props}
    />
  ),
  td: ({ node, ...props }) => (
    <td
      className="border-t border-slate-100 px-4 py-2.5 align-top text-[0.875rem] text-slate-700"
      {...props}
    />
  ),
  tbody: ({ node, ...props }) => (
    <tbody className="divide-y divide-slate-100 [&>tr:nth-child(even)]:bg-slate-50/60" {...props} />
  ),
  tr: ({ node, ...props }) => <tr className="transition-colors hover:bg-blue-50/40" {...props} />,
  pre: ({ node, ...props }) => (
    <pre
      className="my-5 overflow-x-auto rounded-xl bg-slate-900 p-4 text-sm leading-relaxed text-slate-100 shadow-sm"
      {...props}
    />
  ),
  code: ({ node, className, children, ...props }) => {
    const isBlock = /language-/.test(className || '');
    if (isBlock) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[0.8em] text-slate-800"
        {...props}
      >
        {children}
      </code>
    );
  },
};
