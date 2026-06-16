import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { Shield, Building2, Users, TrendingUp, DollarSign, Plus, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { apiClient } from "../services/api/client";

// ---- Types inferred from client.ts responses ----
type OverviewData = {
  tenants: number;
  users: number;
  leads: number;
  deals: number;
  activeSubscriptions: number;
  mrr: number;
};

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  _count: { users: number; leads: number };
  subscription?: { status: string; plan: { type: string; name: string } } | null;
};

const PLAN_LABELS: Record<string, string> = {
  STARTER: "Starter",
  PRO: "Pro",
  ENTERPRISE: "Enterprise",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  TRIAL: "secondary",
  CANCELLED: "destructive",
  PAST_DUE: "destructive",
};

function formatMRR(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function PlatformAdmin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    tenantName: "",
    slug: "",
    planType: "STARTER" as "STARTER" | "PRO" | "ENTERPRISE",
    subscriptionStatus: "TRIAL" as "ACTIVE" | "TRIAL",
    adminEmail: "",
    adminName: "",
    adminPassword: "",
  });

  // Redirect if not platform admin
  if (!user?.isPlatformAdmin) {
    navigate("/app");
    return null;
  }

  const overviewQuery = useQuery({
    queryKey: ["platform-overview"],
    queryFn: async () => {
      const res = await apiClient.getPlatformOverview();
      return res.data as OverviewData;
    },
  });

  const tenantsQuery = useQuery({
    queryKey: ["platform-tenants"],
    queryFn: async () => {
      const res = await apiClient.getPlatformTenants();
      return res.data as TenantRow[];
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) =>
      apiClient.createPlatformTenant({
        tenantName: data.tenantName,
        slug: data.slug,
        planType: data.planType,
        subscriptionStatus: data.subscriptionStatus,
        adminEmail: data.adminEmail,
        adminName: data.adminName,
        adminPassword: data.adminPassword || undefined,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["platform-overview"] });
      queryClient.invalidateQueries({ queryKey: ["platform-tenants"] });
      setCreateOpen(false);
      setForm({
        tenantName: "",
        slug: "",
        planType: "STARTER",
        subscriptionStatus: "TRIAL",
        adminEmail: "",
        adminName: "",
        adminPassword: "",
      });
      const pwd = res.data?.generatedPassword;
      if (pwd) {
        toast.success("Tenant criado com sucesso", {
          description: `Senha gerada (copie agora): ${pwd}`,
          duration: 20000,
        });
      } else {
        toast.success("Tenant criado com sucesso", {
          description: "Usuário já existia — senha preservada.",
        });
      }
    },
    onError: (err: Error) => {
      toast.error("Erro ao criar tenant", { description: err.message });
    },
  });

  const overview = overviewQuery.data;
  const tenants = tenantsQuery.data ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <Shield className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Administração da Plataforma</h1>
            <p className="text-sm text-gray-500">Visão global de todos os tenants</p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="flex items-center gap-2">
          <Plus size={16} />
          Novo Tenant
        </Button>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <OverviewCard
          icon={<Building2 size={18} />}
          label="Tenants"
          value={overview?.tenants}
          loading={overviewQuery.isLoading}
        />
        <OverviewCard
          icon={<Users size={18} />}
          label="Usuários"
          value={overview?.users}
          loading={overviewQuery.isLoading}
        />
        <OverviewCard
          icon={<Users size={18} />}
          label="Leads"
          value={overview?.leads}
          loading={overviewQuery.isLoading}
        />
        <OverviewCard
          icon={<TrendingUp size={18} />}
          label="Deals"
          value={overview?.deals}
          loading={overviewQuery.isLoading}
        />
        <OverviewCard
          icon={<Shield size={18} />}
          label="Assinaturas"
          value={overview?.activeSubscriptions}
          loading={overviewQuery.isLoading}
        />
        <OverviewCard
          icon={<DollarSign size={18} />}
          label="MRR"
          value={overview ? formatMRR(overview.mrr) : undefined}
          loading={overviewQuery.isLoading}
        />
      </div>

      {/* Tenant table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tenants</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {tenantsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-gray-400" size={24} />
            </div>
          ) : tenantsQuery.isError ? (
            <div className="flex items-center gap-2 text-red-600 p-6">
              <AlertCircle size={16} />
              <span className="text-sm">Erro ao carregar tenants.</span>
            </div>
          ) : tenants.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-12">Nenhum tenant encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500 text-xs uppercase tracking-wide">
                    <th className="px-6 py-3 font-medium">Nome</th>
                    <th className="px-6 py-3 font-medium">Slug</th>
                    <th className="px-6 py-3 font-medium">Plano</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium text-right">Usuários</th>
                    <th className="px-6 py-3 font-medium text-right">Leads</th>
                    <th className="px-6 py-3 font-medium">Criado em</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t) => (
                    <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3 font-medium text-gray-900">{t.name}</td>
                      <td className="px-6 py-3 text-gray-500 font-mono text-xs">{t.slug}</td>
                      <td className="px-6 py-3">
                        {t.subscription ? (
                          <span className="text-gray-700">{PLAN_LABELS[t.subscription.plan.type] ?? t.subscription.plan.type}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        {t.subscription ? (
                          <Badge variant={STATUS_VARIANT[t.subscription.status] ?? "outline"}>
                            {t.subscription.status}
                          </Badge>
                        ) : (
                          <span className="text-gray-400 text-xs">sem assinatura</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right text-gray-700">{t._count.users}</td>
                      <td className="px-6 py-3 text-right text-gray-700">{t._count.leads}</td>
                      <td className="px-6 py-3 text-gray-500">
                        {new Date(t.createdAt).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Tenant Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Tenant</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="tenantName">Nome da empresa</Label>
              <Input
                id="tenantName"
                value={form.tenantName}
                onChange={(e) => setForm((f) => ({ ...f, tenantName: e.target.value }))}
                placeholder="Acme Ltda"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="slug">Slug (único)</Label>
              <Input
                id="slug"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") }))}
                placeholder="acme-ltda"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Plano</Label>
                <Select
                  value={form.planType}
                  onValueChange={(v) => setForm((f) => ({ ...f, planType: v as typeof form.planType }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STARTER">Starter</SelectItem>
                    <SelectItem value="PRO">Pro</SelectItem>
                    <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.subscriptionStatus}
                  onValueChange={(v) => setForm((f) => ({ ...f, subscriptionStatus: v as typeof form.subscriptionStatus }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TRIAL">Trial</SelectItem>
                    <SelectItem value="ACTIVE">Ativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <hr className="border-gray-200" />
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Admin do tenant</p>
            <div className="space-y-1.5">
              <Label htmlFor="adminName">Nome</Label>
              <Input
                id="adminName"
                value={form.adminName}
                onChange={(e) => setForm((f) => ({ ...f, adminName: e.target.value }))}
                placeholder="João Silva"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adminEmail">E-mail</Label>
              <Input
                id="adminEmail"
                type="email"
                value={form.adminEmail}
                onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))}
                placeholder="joao@acme.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adminPassword">Senha (opcional — gerada automaticamente se vazio)</Label>
              <Input
                id="adminPassword"
                type="password"
                value={form.adminPassword}
                onChange={(e) => setForm((f) => ({ ...f, adminPassword: e.target.value }))}
                placeholder="deixe vazio para gerar"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending || !form.tenantName || !form.slug || !form.adminEmail || !form.adminName}
            >
              {createMutation.isPending && <Loader2 className="mr-2 animate-spin" size={14} />}
              Criar Tenant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Sub-component ----
function OverviewCard({
  icon,
  label,
  value,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number | string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-gray-500 mb-2">
          {icon}
          <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
        </div>
        {loading ? (
          <div className="h-7 w-12 bg-gray-100 rounded animate-pulse" />
        ) : (
          <p className="text-2xl font-bold text-gray-900">{value ?? "—"}</p>
        )}
      </CardContent>
    </Card>
  );
}
