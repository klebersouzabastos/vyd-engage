import { useSearchParams } from "react-router";
import { Header } from "../components/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Bell, Building2, Plug, CreditCard, Tag, Target } from "lucide-react";
import { TagManager } from "../components/TagManager";
import { CompanyTab } from "../components/settings/CompanyTab";
import { NotificationsTab } from "../components/settings/NotificationsTab";
import { IntegrationsTab } from "../components/settings/IntegrationsTab";
import { BillingTab } from "../components/settings/BillingTab";
import { CustomFieldsTab } from "../components/settings/CustomFieldsTab";
import { LeadScoringTab } from "../components/settings/LeadScoringTab";

export function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "company";

  return (
    <div className="min-h-screen">
      <Header title="Configurações" subtitle="Gerencie as configurações da sua conta" />

      <div className="p-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-300">
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              setSearchParams({ tab: value });
            }}
            className="w-full"
          >
            <div className="border-b border-gray-300 px-6">
              <TabsList className="bg-transparent h-auto p-0 gap-8">
                <TabsTrigger
                  value="company"
                  className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-4 px-0"
                >
                  <Building2 size={16} className="mr-2" />
                  Empresa
                </TabsTrigger>
                <TabsTrigger
                  value="notifications"
                  className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-4 px-0"
                >
                  <Bell size={16} className="mr-2" />
                  Notificações
                </TabsTrigger>
                <TabsTrigger
                  value="integrations"
                  className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-4 px-0"
                >
                  <Plug size={16} className="mr-2" />
                  Integrações
                </TabsTrigger>
                <TabsTrigger
                  value="billing"
                  className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-4 px-0"
                >
                  <CreditCard size={16} className="mr-2" />
                  Planos
                </TabsTrigger>
                <TabsTrigger
                  value="tags"
                  className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-4 px-0"
                >
                  <Tag size={16} className="mr-2" />
                  Tags
                </TabsTrigger>
                <TabsTrigger
                  value="custom-fields"
                  className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-4 px-0"
                >
                  <Tag size={16} className="mr-2" />
                  Campos Customizados
                </TabsTrigger>
                <TabsTrigger
                  value="lead-scoring"
                  className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-4 px-0"
                >
                  <Target size={16} className="mr-2" />
                  Lead Scoring
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="company" className="p-6">
              <CompanyTab />
            </TabsContent>

            <TabsContent value="notifications" className="p-6">
              <NotificationsTab />
            </TabsContent>

            <TabsContent value="integrations" className="p-6">
              <IntegrationsTab />
            </TabsContent>

            <TabsContent value="billing" className="p-6">
              <BillingTab />
            </TabsContent>

            <TabsContent value="tags" className="p-6">
              <TagManager />
            </TabsContent>

            <TabsContent value="custom-fields" className="p-6">
              <CustomFieldsTab />
            </TabsContent>

            <TabsContent value="lead-scoring" className="p-6">
              <LeadScoringTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
