import { useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { Header } from "../components/Header";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { PageSkeleton } from "../components/PageSkeleton";
import { EmptyState } from "../components/EmptyState";
import { useCompanies } from "../hooks/useCompanies";
import { Company, CompanySize } from "../types";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Building2,
  Users,
  Handshake,
  Globe,
} from "lucide-react";
import { CompanyForm } from "../components/CompanyForm";

const SIZE_LABELS: Record<CompanySize, string> = {
  MICRO: "Micro",
  SMALL: "Pequena",
  MEDIUM: "Média",
  LARGE: "Grande",
  ENTERPRISE: "Enterprise",
};

const SIZE_OPTIONS: { value: string; label: string }[] = [
  { value: "ALL", label: "Todos os Portes" },
  { value: "MICRO", label: "Micro" },
  { value: "SMALL", label: "Pequena" },
  { value: "MEDIUM", label: "Média" },
  { value: "LARGE", label: "Grande" },
  { value: "ENTERPRISE", label: "Enterprise" },
];

function formatDate(date: string | null | undefined): string {
  if (!date) return "\u2014";
  return new Date(date).toLocaleDateString("pt-BR");
}

export function Companies() {
  const navigate = useNavigate();
  const { companies, loading, pagination, fetchCompanies, createCompany, updateCompany, deleteCompany } = useCompanies();

  const [search, setSearch] = useState("");
  const [sizeFilter, setSizeFilter] = useState("ALL");
  const [formOpen, setFormOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);

  const handleSearch = useCallback(() => {
    const filters: Record<string, string | number | undefined> = { page: 1 };
    if (search.trim()) filters.search = search.trim();
    if (sizeFilter !== "ALL") filters.size = sizeFilter;
    fetchCompanies(filters);
  }, [search, sizeFilter, fetchCompanies]);

  const handleSizeChange = useCallback((value: string) => {
    setSizeFilter(value);
    const filters: Record<string, string | number | undefined> = { page: 1 };
    if (search.trim()) filters.search = search.trim();
    if (value !== "ALL") filters.size = value;
    fetchCompanies(filters);
  }, [search, fetchCompanies]);

  const handlePageChange = useCallback((page: number) => {
    const filters: Record<string, string | number | undefined> = { page };
    if (search.trim()) filters.search = search.trim();
    if (sizeFilter !== "ALL") filters.size = sizeFilter;
    fetchCompanies(filters);
  }, [search, sizeFilter, fetchCompanies]);

  const handleSave = async (data: Partial<Company>) => {
    if (editingCompany) {
      await updateCompany(editingCompany.id, data);
    } else {
      await createCompany(data);
    }
    setFormOpen(false);
    setEditingCompany(null);
  };

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!companyToDelete) return;
    await deleteCompany(companyToDelete.id);
    setDeleteDialogOpen(false);
    setCompanyToDelete(null);
  };

  if (loading && companies.length === 0) {
    return (
      <div className="min-h-screen">
        <Header title="Empresas" subtitle="Gerenciamento de empresas" />
        <PageSkeleton type="table" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="Empresas" subtitle="Gerenciamento de empresas" />

      <div className="p-8">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
            <div className="relative flex-1 max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
              <Input
                placeholder="Buscar empresas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-9"
                aria-label="Buscar empresas"
              />
            </div>
            <Select value={sizeFilter} onValueChange={handleSizeChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIZE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={() => { setEditingCompany(null); setFormOpen(true); }} className="gap-2">
            <Plus size={16} />
            Nova Empresa
          </Button>
        </div>

        {/* Table */}
        <div className="bg-gray-50 rounded-lg shadow-sm border border-gray-300 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" aria-label="Lista de empresas">
              <thead>
                <tr className="border-b border-gray-300 bg-gray-50">
                  <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Nome</th>
                  <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Dominio</th>
                  <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Industria</th>
                  <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Porte</th>
                  <th scope="col" className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Leads</th>
                  <th scope="col" className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Deals</th>
                  <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Criado em</th>
                  <th scope="col" className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {companies.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState
                        icon={Building2}
                        title={search.trim() || sizeFilter !== "ALL" ? "Nenhuma empresa encontrada" : "Nenhuma empresa criada"}
                        description={
                          search.trim() || sizeFilter !== "ALL"
                            ? "Tente ajustar os filtros ou termos de busca"
                            : "Comece adicionando sua primeira empresa para organizar seus leads e deals"
                        }
                        actionLabel="Nova Empresa"
                        onAction={() => { setEditingCompany(null); setFormOpen(true); }}
                      />
                    </td>
                  </tr>
                ) : (
                  companies.map((company) => (
                    <tr
                      key={company.id}
                      className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/app/companies/${company.id}`)}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Building2 size={16} className="text-gray-400 flex-shrink-0" />
                          <span className="font-medium text-gray-900">{company.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {company.domain ? (
                          <span className="flex items-center gap-1">
                            <Globe size={12} className="text-gray-400" />
                            {company.domain}
                          </span>
                        ) : "\u2014"}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {company.industry || "\u2014"}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {company.size ? SIZE_LABELS[company.size] : "\u2014"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                          <Users size={12} className="text-gray-400" />
                          {company._count?.leads ?? 0}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                          <Handshake size={12} className="text-gray-400" />
                          {company._count?.deals ?? 0}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {formatDate(company.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleEdit(company)}
                            className="p-1.5 rounded hover:bg-gray-200 text-gray-500 transition-colors"
                            aria-label={`Editar empresa ${company.name}`}
                          >
                            <Pencil size={14} aria-hidden="true" />
                          </button>
                          <button
                            onClick={() => { setCompanyToDelete(company); setDeleteDialogOpen(true); }}
                            className="p-1.5 rounded hover:bg-red-100 text-gray-500 hover:text-red-600 transition-colors"
                            aria-label={`Excluir empresa ${company.name}`}
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <span className="text-sm text-gray-600">
                {pagination.total} empresa{pagination.total !== 1 ? "s" : ""} &bull; Pagina {pagination.page} de {pagination.totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => handlePageChange(pagination.page - 1)}
                >
                  <ChevronLeft size={14} />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => handlePageChange(pagination.page + 1)}
                >
                  <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Company Form Modal */}
      <Dialog open={formOpen} onOpenChange={(open) => { if (!open) { setFormOpen(false); setEditingCompany(null); } }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingCompany ? "Editar Empresa" : "Nova Empresa"}</DialogTitle>
          </DialogHeader>
          <CompanyForm
            company={editingCompany}
            onSave={handleSave}
            onCancel={() => { setFormOpen(false); setEditingCompany(null); }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Empresa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a empresa "{companyToDelete?.name}"? Esta acao nao pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
