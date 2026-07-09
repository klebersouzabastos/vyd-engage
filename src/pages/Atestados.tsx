import { Header } from '@/components/Header';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AcervoTab } from '@/components/atestados/AcervoTab';
import { BuscaTab } from '@/components/atestados/BuscaTab';
import { ConcorrenciasTab } from '@/components/atestados/ConcorrenciasTab';
import { PendenciasTab } from '@/components/atestados/PendenciasTab';
import { ProfissionaisTab } from '@/components/atestados/ProfissionaisTab';
import { TerceirosTab } from '@/components/atestados/TerceirosTab';
import { ConfigTab } from '@/components/atestados/ConfigTab';

export function Atestados() {
  return (
    <div className="min-h-screen">
      <Header
        title="Atestados Técnicos"
        subtitle="Acervo técnico, inteligência de concorrências e gestão de atestados pendentes."
      />
      <div className="px-4 md:px-8 py-6">
        <Tabs defaultValue="acervo">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="acervo">Acervo</TabsTrigger>
            <TabsTrigger value="busca">Busca inteligente</TabsTrigger>
            <TabsTrigger value="concorrencias">Concorrências</TabsTrigger>
            <TabsTrigger value="pendencias">Pendências</TabsTrigger>
            <TabsTrigger value="profissionais">Profissionais</TabsTrigger>
            <TabsTrigger value="terceiros">Terceiros</TabsTrigger>
            <TabsTrigger value="config">Configurações</TabsTrigger>
          </TabsList>
          <TabsContent value="acervo" className="mt-4">
            <AcervoTab />
          </TabsContent>
          <TabsContent value="busca" className="mt-4">
            <BuscaTab />
          </TabsContent>
          <TabsContent value="concorrencias" className="mt-4">
            <ConcorrenciasTab />
          </TabsContent>
          <TabsContent value="pendencias" className="mt-4">
            <PendenciasTab />
          </TabsContent>
          <TabsContent value="profissionais" className="mt-4">
            <ProfissionaisTab />
          </TabsContent>
          <TabsContent value="terceiros" className="mt-4">
            <TerceirosTab />
          </TabsContent>
          <TabsContent value="config" className="mt-4">
            <ConfigTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
