import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Header } from "../components/Header";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { Switch } from "../components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
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
import { Plus, Search, Pencil, Trash2, Package } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

interface Product {
  id: string;
  name: string;
  description?: string;
  unitPrice: number;
  category?: string;
  active: boolean;
  createdAt?: string;
}

interface ProductPayload {
  name: string;
  description: string;
  unitPrice: number;
  category: string;
  active: boolean;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem("accessToken");
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Erro na requisição");
  }
  const data = await res.json();
  return (data.data ?? data) as T;
}

const EMPTY_FORM: ProductPayload = {
  name: "",
  description: "",
  unitPrice: 0,
  category: "",
  active: true,
};

export function Products() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductPayload>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  // List
  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => apiFetch<Product[]>("/api/v1/products"),
    staleTime: 2 * 60 * 1000,
  });

  // Create
  const createMutation = useMutation({
    mutationFn: (payload: ProductPayload) =>
      apiFetch<Product>("/api/v1/products", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setDialogOpen(false);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  // Update
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ProductPayload> }) =>
      apiFetch<Product>(`/api/v1/products/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setDialogOpen(false);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  // Delete
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/products/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setDeleteId(null);
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.category ?? "").toLowerCase().includes(q)
    );
  }, [products, search]);

  function openCreate() {
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(product: Product) {
    setEditingProduct(product);
    setForm({
      name: product.name,
      description: product.description ?? "",
      unitPrice: product.unitPrice,
      category: product.category ?? "",
      active: product.active,
    });
    setFormError(null);
    setDialogOpen(true);
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) {
      setFormError("O nome do produto é obrigatório.");
      return;
    }
    if (form.unitPrice < 0) {
      setFormError("O preço não pode ser negativo.");
      return;
    }
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, payload: form });
    } else {
      createMutation.mutate(form);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-screen">
      <Header title="Produtos" subtitle="Catálogo de produtos do seu tenant" />

      <div className="p-4 md:p-8">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por nome ou categoria..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button onClick={openCreate} className="flex items-center gap-2">
            <Plus size={16} />
            Novo produto
          </Button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-300 overflow-hidden">
          {isLoading ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    {["Nome", "Categoria", "Preço", "Status", "Ações"].map((h) => (
                      <th
                        key={h}
                        className={`py-3 px-4 text-xs font-medium text-gray-500 uppercase ${h === "Ações" || h === "Preço" || h === "Status" ? "text-right" : "text-left"}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-3 px-4"><Skeleton className="h-4 w-40" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>
                      <td className="py-3 px-4 text-right"><Skeleton className="h-4 w-20 ml-auto" /></td>
                      <td className="py-3 px-4 text-right"><Skeleton className="h-5 w-16 ml-auto rounded-full" /></td>
                      <td className="py-3 px-4 text-right"><Skeleton className="h-7 w-16 ml-auto" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center">
              <Package className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">
                {search ? "Nenhum produto encontrado para a busca." : "Nenhum produto cadastrado ainda."}
              </p>
              {!search && (
                <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}>
                  <Plus size={14} className="mr-1" />
                  Adicionar produto
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Nome</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Categoria</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Preço Unitário</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((product) => (
                    <tr
                      key={product.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <p className="text-sm font-medium text-gray-900">{product.name}</p>
                        {product.description && (
                          <p className="text-xs text-gray-400 truncate max-w-xs">{product.description}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {product.category || <span className="text-gray-300 italic">—</span>}
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-gray-900 text-right">
                        {formatCurrency(product.unitPrice)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Badge
                          className={
                            product.active
                              ? "bg-green-100 text-green-700 hover:bg-green-100"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-100"
                          }
                        >
                          {product.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-gray-400 hover:text-primary"
                            onClick={() => openEdit(product)}
                          >
                            <Pencil size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-gray-400 hover:text-red-500"
                            onClick={() => setDeleteId(product.id)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!isSaving) setDialogOpen(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Editar produto" : "Novo produto"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleFormSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="prod-name">Nome *</Label>
              <Input
                id="prod-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex.: Consultoria Mensal"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prod-description">Descrição</Label>
              <Input
                id="prod-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Breve descrição do produto"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="prod-price">Preço Unitário (R$) *</Label>
                <Input
                  id="prod-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.unitPrice}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, unitPrice: parseFloat(e.target.value) || 0 }))
                  }
                  placeholder="0,00"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prod-category">Categoria</Label>
                <Input
                  id="prod-category"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="Ex.: Serviço"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="prod-active"
                checked={form.active}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, active: checked }))}
              />
              <Label htmlFor="prod-active" className="cursor-pointer">
                {form.active ? "Ativo" : "Inativo"}
              </Label>
            </div>

            {formError && (
              <p className="text-sm text-red-500">{formError}</p>
            )}

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Salvando..." : editingProduct ? "Salvar alterações" : "Criar produto"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
