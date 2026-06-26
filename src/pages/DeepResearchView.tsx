import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  ArrowLeft,
  Pencil,
  ListTree,
  Sparkles,
  FileEdit,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { Header } from '../components/Header';
import { Button, buttonVariants } from '../components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../components/ui/breadcrumb';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerClose,
} from '../components/ui/drawer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ReportRenderer } from '../components/deepResearch/ReportRenderer';
import { ReportTOC } from '../components/deepResearch/ReportTOC';
import { extractToc } from '../components/deepResearch/extractToc';
import { sanitizeReportMarkdown } from '../components/deepResearch/sanitizeReportMarkdown';
import { useActiveHeading } from '../components/deepResearch/useActiveHeading';
import { ResearchEditor } from '../components/deepResearch/ResearchEditor';
import { AdminProcessPanel } from '../components/deepResearch/AdminProcessPanel';
import { useDeepResearchItem, useDeepResearchTemplates } from '../hooks/useDeepResearch';
import { useAuth } from '../contexts/AuthContext';

export function DeepResearchView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isPlatformAdmin = !!user?.isPlatformAdmin;

  const itemQuery = useDeepResearchItem(id);
  const templatesQuery = useDeepResearchTemplates();
  const [editorOpen, setEditorOpen] = useState(false);

  const item = itemQuery.data;
  const rawMarkdown = item?.reportMarkdown ?? '';
  const { markdown } = useMemo(() => sanitizeReportMarkdown(rawMarkdown), [rawMarkdown]);
  const toc = useMemo(() => extractToc(markdown), [markdown]);
  const tocIds = useMemo(() => toc.map((t) => t.id), [toc]);
  const activeId = useActiveHeading(tocIds);

  const hasReport = item?.status === 'COMPLETED' && markdown.trim().length > 0;
  const sourceCount = item?.reportMeta?.sources?.length ?? 0;
  const searchResults = item?.reportMeta?.searchResults ?? [];

  // Conteúdo do relatório (web page renderizada ou estado vazio). Reutilizado na
  // aba "Relatório" do platform admin e na visão direta do usuário comum.
  const reportBody = !item ? null : hasReport ? (
    <>
      {/* Sumário no mobile (drawer) */}
      {toc.length > 0 && (
        <div className="mb-4 md:hidden">
          <Drawer direction="left">
            <DrawerTrigger className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <ListTree className="mr-1 h-4 w-4" />
              Sumário
            </DrawerTrigger>
            <DrawerContent className="w-72 p-4">
              <DrawerHeader className="p-0">
                <DrawerTitle className="sr-only">Sumário</DrawerTitle>
              </DrawerHeader>
              <DrawerClose asChild>
                <div className="mt-2 overflow-y-auto">
                  <ReportTOC items={toc} activeId={activeId} />
                </div>
              </DrawerClose>
            </DrawerContent>
          </Drawer>
        </div>
      )}

      <div className="md:grid md:grid-cols-[260px_1fr] md:gap-8">
        {toc.length > 0 && (
          <aside className="hidden md:block">
            <div className="sticky top-6 max-h-[calc(100vh-6rem)] overflow-y-auto">
              <ReportTOC items={toc} activeId={activeId} />
            </div>
          </aside>
        )}

        <div className="min-w-0">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-6 py-3 md:px-10">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Relatório · Inteligência de Mercado
              </span>
              <span className="text-xs text-slate-400">
                {item.template?.name ? `${item.template.name} · ` : ''}
                {new Date(item.updatedAt).toLocaleDateString('pt-BR')}
              </span>
            </div>
            <div className="px-6 py-8 md:px-10">
              <ReportRenderer markdown={markdown} />
              {searchResults.length > 0 ? (
                <section className="mt-10 border-t border-slate-200 pt-6">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Fontes ({searchResults.length})
                  </p>
                  <ol className="space-y-2">
                    {searchResults.map((s, i) => (
                      <li key={`${s.url}-${i}`} className="flex items-baseline gap-2 text-sm">
                        <span className="shrink-0 select-none text-xs tabular-nums text-slate-400">
                          {i + 1}.
                        </span>
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group inline-flex min-w-0 items-baseline gap-1 text-slate-700 hover:text-primary"
                        >
                          <span className="truncate underline decoration-slate-300 underline-offset-2 group-hover:decoration-primary">
                            {s.title?.trim() || hostnameOf(s.url)}
                          </span>
                          <ExternalLink className="h-3 w-3 shrink-0 self-center text-slate-300 group-hover:text-primary" />
                        </a>
                        {s.date && (
                          <span className="ml-auto shrink-0 text-xs text-slate-400">{s.date}</span>
                        )}
                      </li>
                    ))}
                  </ol>
                </section>
              ) : (
                sourceCount > 0 && (
                  <p className="mt-10 border-t border-slate-200 pt-4 text-xs text-slate-400">
                    Relatório gerado com {sourceCount} citação(ões).
                  </p>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  ) : (
    <StatusState status={item.status} onEdit={() => setEditorOpen(true)} />
  );

  return (
    <div className="min-h-screen bg-slate-50/60">
      <Header title={item?.title ?? 'Inteligência de Mercado'} subtitle="Inteligência de Mercado" />

      <div className="p-4 md:p-8">
        {/* Navegação e ações */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink
                  href="/app/deep-research"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/app/deep-research');
                  }}
                >
                  Inteligência de Mercado
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{item?.title ?? '…'}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/app/deep-research')}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Voltar
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditorOpen(true)}>
              <Pencil className="mr-1 h-4 w-4" />
              Editar
            </Button>
          </div>
        </div>

        {itemQuery.isLoading ? (
          <p className="py-12 text-center text-sm text-slate-500">Carregando…</p>
        ) : !item ? (
          <p className="py-12 text-center text-sm text-slate-500">Pesquisa não encontrada.</p>
        ) : isPlatformAdmin ? (
          // Platform admin vê o relatório (web page) e o prompt/processamento em
          // abas distintas — o prompt é IP da plataforma e não chega ao usuário comum.
          <Tabs defaultValue="report" className="gap-4">
            <TabsList className="w-fit">
              <TabsTrigger value="report" className="px-4">
                Relatório
              </TabsTrigger>
              <TabsTrigger value="prompt" className="px-4">
                Prompt
              </TabsTrigger>
            </TabsList>
            <TabsContent value="report" className="mt-2">
              {reportBody}
            </TabsContent>
            <TabsContent value="prompt" className="mt-2">
              <AdminProcessPanel research={item} />
            </TabsContent>
          </Tabs>
        ) : (
          reportBody
        )}
      </div>

      {item && (
        <ResearchEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          templates={templatesQuery.data?.items ?? []}
          research={item}
        />
      )}
    </div>
  );
}

/** Estado da pesquisa quando ainda não há relatório (visão do usuário). */
function StatusState({
  status,
  onEdit,
}: {
  status: 'DRAFT' | 'RESEARCHING' | 'COMPLETED' | 'FAILED';
  onEdit: () => void;
}) {
  const config = {
    RESEARCHING: {
      icon: <Sparkles className="h-10 w-10 text-primary" />,
      title: 'Pesquisa em andamento',
      desc: 'Estamos preparando seu relatório de inteligência de mercado com os dados que você informou. Ele aparecerá aqui assim que estiver pronto.',
      action: null,
    },
    DRAFT: {
      icon: <FileEdit className="h-10 w-10 text-slate-300" />,
      title: 'Rascunho',
      desc: 'Complete as informações e solicite a pesquisa para gerar o relatório.',
      action: (
        <Button className="mt-4" onClick={onEdit}>
          <Pencil className="mr-1 h-4 w-4" />
          Editar e solicitar
        </Button>
      ),
    },
    FAILED: {
      icon: <AlertTriangle className="h-10 w-10 text-red-400" />,
      title: 'Não foi possível concluir',
      desc: 'Houve um problema ao gerar o relatório. Revise os dados e solicite novamente.',
      action: (
        <Button className="mt-4" onClick={onEdit}>
          <Pencil className="mr-1 h-4 w-4" />
          Revisar
        </Button>
      ),
    },
    COMPLETED: {
      icon: <Sparkles className="h-10 w-10 text-primary" />,
      title: 'Relatório indisponível',
      desc: 'O relatório foi marcado como concluído, mas não há conteúdo para exibir.',
      action: null,
    },
  }[status];

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center">
      {config.icon}
      <p className="mt-3 font-medium text-slate-900">{config.title}</p>
      <p className="mt-1 max-w-md text-sm text-slate-500">{config.desc}</p>
      {config.action}
    </div>
  );
}

/** Nome de host limpo (sem www) para usar como rótulo de uma fonte sem título. */
function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
