import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { DataTable } from '../components/ui/data-table';
import { getCompanyColumns } from '../components/companies/companyColumns';
import { Header } from '../components/Header';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { PageSkeleton } from '../components/PageSkeleton';
import { EmptyState } from '../components/EmptyState';
import { useCompanies } from '../hooks/useCompanies';
import { Company, CompanySize } from '../types';
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
} from 'lucide-react';
import { CompanyForm } from '../components/CompanyForm';

const SIZE_LABELS: Record<CompanySize, string> = {
  MICRO: 'Micro',
  SMALL: 'Pequena',
  MEDIUM: 'Média',
  LARGE: 'Grande',
  ENTERPRISE: 'Enterprise',
};

const SIZE_OPTIONS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'Todos os Portes' },
  { value: 'MICRO', label: 'Micro' },
  { value: 'SMALL', label: 'Pequena' },
  { value: 'MEDIUM', label: 'Média' },
  { value: 'LARGE', label: 'Grande' },
  { value: 'ENTERPRISE', label: 'Enterprise' },
];

function formatDate(date: string | null | undefined): string {
  if (!date) return '\u2014';
  return new Date(date).toLocaleDateString('pt-BR');
}

export function Companies() {
  const navigate = useNavigate();
  const {
    companies,
    loading,
    pagination,
    fetchCompanies,
    createCompany,
    updateCompany,
    deleteCompany,
  } = useCompanies();

  const [search, setSearch] = useState('');
  const [sizeFilter, setSizeFilter] = useState('ALL');
  const [formOpen, setFormOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);

  const handleSearch = useCallback(() => {
    const filters: Record<string, string | number | undefined> = { page: 1 };
    if (search.trim()) filters.search = search.trim();
    if (sizeFilter !== 'ALL') filters.size = sizeFilter;
    fetchCompanies(filters);
  }, [search, sizeFilter, fetchCompanies]);

  const handleSizeChange = useCallback(
    (value: string) => {
      setSizeFilter(value);
      const filters: Record<string, string | number | undefined> = { page: 1 };
      if (search.trim()) filters.search = search.trim();
      if (value !== 'ALL') filters.size = value;
      fetchCompanies(filters);
    },
    [search, fetchCompanies]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      const filters: Record<string, string | number | undefined> = { page };
      if (search.trim()) filters.search = search.trim();
      if (sizeFilter !== 'ALL') filters.size = sizeFilter;
      fetchCompanies(filters);
    },
    [search, sizeFilter, fetchCompanies]
  );

  // Filtrar ao digitar: refaz a busca (server-side) com debounce ao alterar o texto.
  useEffect(() => {
    const t = setTimeout(() => handleSearch(), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

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

  // Column defs for the companies list table (handlers use stable setters)
  const companyTableColumns = useMemo(
    () =>
      getCompanyColumns({
        onEdit: handleEdit,
        onDelete: (company: Company) => {
          setCompanyToDelete(company);
          setDeleteDialogOpen(true);
        },
      }),

    []
  );

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
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                aria-hidden="true"
              />
              <Input
                placeholder="Buscar empresas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
                aria-label="Buscar empresas"
              />
            </div>
            <Select value={sizeFilter} onValueChange={handleSizeChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIZE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={() => {
              setEditingCompany(null);
              setFormOpen(true);
            }}
            className="gap-2"
          >
            <Plus size={16} />
            Nova Empresa
          </Button>
        </div>

        {/* Table */}
        <div className="bg-gray-50 rounded-lg shadow-sm border border-gray-300 overflow-hidden">
          <div className="overflow-x-auto">
            <DataTable
              columns={companyTableColumns}
              data={companies}
              onRowClick={(company) => navigate(`/app/companies/${company.id}`)}
              emptyState={
                <EmptyState
                  icon={Building2}
                  title={
                    search.trim() || sizeFilter !== 'ALL'
                      ? 'Nenhuma empresa encontrada'
                      : 'Nenhuma empresa criada'
                  }
                  description={
                    search.trim() || sizeFilter !== 'ALL'
                      ? 'Tente ajustar os filtros ou termos de busca'
                      : 'Comece adicionando sua primeira empresa para organizar seus leads e deals'
                  }
                  actionLabel="Nova Empresa"
                  onAction={() => {
                    setEditingCompany(null);
                    setFormOpen(true);
                  }}
                />
              }
            />
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <span className="text-sm text-gray-600">
                {pagination.total} empresa{pagination.total !== 1 ? 's' : ''} &bull; Pagina{' '}
                {pagination.page} de {pagination.totalPages}
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
      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) {
            setFormOpen(false);
            setEditingCompany(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingCompany ? 'Editar Empresa' : 'Nova Empresa'}</DialogTitle>
          </DialogHeader>
          <CompanyForm
            company={editingCompany}
            onSave={handleSave}
            onCancel={() => {
              setFormOpen(false);
              setEditingCompany(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Empresa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a empresa "{companyToDelete?.name}"? Esta acao nao pode
              ser desfeita.
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
