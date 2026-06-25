import { useCallback, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Upload,
  FileSpreadsheet,
  X,
  AlertCircle,
  CheckCircle2,
  Users,
  RotateCcw,
  Loader2,
  History as HistoryIcon,
  Copy as CopyIcon,
  TriangleAlert,
} from "lucide-react";
import { Header } from "../components/Header";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { ColumnMapper, IGNORE_VALUE, type MappingTarget } from "../components/import/ColumnMapper";
import { useCustomFields } from "../contexts/CustomFieldsContext";
import {
  apiClient,
  type ImportBatch,
  type ImportBatchStatus,
  type ImportDuplicateAction,
  type ImportResult,
  type ImportType,
} from "../services/api/client";
import { getErrorMessage } from "../utils/errors";
import {
  ImportParseError,
  parseImportFile,
  type ParsedFile,
} from "../utils/importParser";

const PREVIEW_ROW_COUNT = 5;

/** Fixed VYD target fields available for lead mapping (spec req 6). */
const LEAD_BASE_TARGETS: MappingTarget[] = [
  { value: "name", label: "Nome (name)" },
  { value: "email", label: "Email (email)" },
  { value: "phone", label: "Telefone (phone)" },
  { value: "company", label: "Empresa (company)" },
  { value: "position", label: "Cargo (position)" },
  { value: "source", label: "Origem (source)" },
  { value: "notes", label: "Observações (notes)" },
  { value: "status", label: "Status (status)" },
];

/** Required columns for the Deals CSV (spec req 17). */
const DEAL_COLUMNS = ["lead_email", "deal_name", "value", "stage", "expected_close_date"];

/** Required columns for the Interactions CSV (spec req 19). */
const INTERACTION_COLUMNS = ["lead_email", "type", "date", "notes"];

// ──────────────────────────────────────────────────────────
// Status helpers (shared by panels + history)
// ──────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ImportBatchStatus, string> = {
  PENDING: "Pendente",
  PROCESSING: "Processando",
  COMPLETED: "Concluída",
  FAILED: "Falhou",
  ROLLED_BACK: "Desfeita",
};

const TYPE_LABELS: Record<ImportType, string> = {
  LEADS: "Leads",
  DEALS: "Deals",
  INTERACTIONS: "Interações",
};

function StatusBadge({ status }: { status: ImportBatchStatus }) {
  const styles: Record<ImportBatchStatus, string> = {
    PENDING: "bg-gray-100 text-gray-600 hover:bg-gray-100",
    PROCESSING: "bg-blue-100 text-blue-700 hover:bg-blue-100",
    COMPLETED: "bg-green-100 text-green-700 hover:bg-green-100",
    FAILED: "bg-red-100 text-red-700 hover:bg-red-100",
    ROLLED_BACK: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  };
  return <Badge className={styles[status]}>{STATUS_LABELS[status]}</Badge>;
}

// ──────────────────────────────────────────────────────────
// File dropzone (drag-and-drop + click to select) — spec req 1
// ──────────────────────────────────────────────────────────

interface DropzoneProps {
  file: File | null;
  onFile: (file: File) => void;
  onClear: () => void;
  disabled?: boolean;
}

function Dropzone({ file, onFile, onClear, disabled }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) onFile(dropped);
  };

  if (file) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-300 bg-white px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <FileSpreadsheet className="h-5 w-5 text-primary flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
            <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={onClear} disabled={disabled} aria-label="Remover arquivo">
          <X size={16} />
        </Button>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !disabled) inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors cursor-pointer ${
        dragging ? "border-primary bg-primary/5" : "border-gray-300 bg-gray-50 hover:bg-gray-100"
      } ${disabled ? "opacity-60 pointer-events-none" : ""}`}
    >
      <Upload className="h-8 w-8 text-gray-400 mb-3" />
      <p className="text-sm font-medium text-gray-700">
        Arraste e solte o arquivo aqui ou clique para selecionar
      </p>
      <p className="text-xs text-gray-500 mt-1">Formatos aceitos: .csv (UTF-8) ou .xlsx — até 10 MB, 10.000 linhas</p>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx"
        className="hidden"
        onChange={(e) => {
          const selected = e.target.files?.[0];
          if (selected) onFile(selected);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Dry-run preview (summary + duplicates + validation errors) — spec reqs 13-16
// ──────────────────────────────────────────────────────────

interface DryRunPreviewProps {
  result: ImportResult;
  duplicateActions: Record<string, ImportDuplicateAction>;
  onDuplicateAction: (key: string, action: ImportDuplicateAction) => void;
  /** Whether per-duplicate skip/update choices are supported (leads only). */
  showDuplicateActions: boolean;
}

function DryRunPreview({ result, duplicateActions, onDuplicateAction, showDuplicateActions }: DryRunPreviewProps) {
  return (
    <div className="space-y-4">
      {/* Summary cards (req 13) */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle2 size={16} />
            <span className="text-xs font-medium uppercase">Novos</span>
          </div>
          <p className="mt-1 text-2xl font-semibold text-green-800">{result.newCount}</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-amber-700">
            <CopyIcon size={16} />
            <span className="text-xs font-medium uppercase">Duplicatas</span>
          </div>
          <p className="mt-1 text-2xl font-semibold text-amber-800">{result.duplicateCount}</p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle size={16} />
            <span className="text-xs font-medium uppercase">Erros</span>
          </div>
          <p className="mt-1 text-2xl font-semibold text-red-800">{result.errorCount}</p>
        </div>
      </div>

      {/* Validation errors (req 15) */}
      {result.errors && result.errors.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-gray-700">Erros de validação</h4>
          <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Linha</TableHead>
                  <TableHead className="w-40">Campo</TableHead>
                  <TableHead>Problema</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.errors.map((err, idx) => (
                  <TableRow key={`${err.row}-${err.field}-${idx}`}>
                    <TableCell className="font-mono text-xs">{err.row}</TableCell>
                    <TableCell className="font-mono text-xs">{err.field}</TableCell>
                    <TableCell className="text-sm text-red-600">{err.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Duplicates with skip/update (req 14) */}
      {result.duplicates && result.duplicates.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-gray-700">Duplicatas detectadas</h4>
          <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
            {result.duplicates.map((dup, idx) => {
              const key = String(dup.row);
              const action = duplicateActions[key] ?? "skip";
              return (
                <div key={`${dup.row}-${idx}`} className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 text-sm">
                    <span className="font-mono text-xs text-gray-400 mr-2">Linha {dup.row}</span>
                    <span className="font-medium text-gray-900">{dup.name || dup.email || dup.phone || dup.value}</span>
                    <span className="ml-2 text-xs text-gray-500">
                      (duplicada por {dup.matchedBy === "email" ? "email" : "telefone"})
                    </span>
                  </div>
                  {showDuplicateActions && (
                    <RadioGroup
                      value={action}
                      onValueChange={(value) => onDuplicateAction(key, value as ImportDuplicateAction)}
                      className="flex flex-row gap-4"
                    >
                      <div className="flex items-center gap-1.5">
                        <RadioGroupItem value="skip" id={`skip-${dup.row}`} />
                        <Label htmlFor={`skip-${dup.row}`} className="cursor-pointer text-sm">Pular</Label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <RadioGroupItem value="update" id={`update-${dup.row}`} />
                        <Label htmlFor={`update-${dup.row}`} className="cursor-pointer text-sm">Atualizar existente</Label>
                      </div>
                    </RadioGroup>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Import panel (one per entity tab)
// ──────────────────────────────────────────────────────────

interface ImportPanelProps {
  entity: "leads" | "deals" | "interactions";
  /** Target fields for the column mapper (leads only). */
  targets?: MappingTarget[];
  /** Required columns hint (deals/interactions, fixed schema). */
  requiredColumns?: string[];
  /** Whether to render the visual column mapper (leads only). */
  withMapper: boolean;
  onImported: () => void;
}

function ImportPanel({ entity, targets, requiredColumns, withMapper, onImported }: ImportPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [dryRunResult, setDryRunResult] = useState<ImportResult | null>(null);
  const [duplicateActions, setDuplicateActions] = useState<Record<string, ImportDuplicateAction>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  const resetAll = useCallback(() => {
    setFile(null);
    setParsed(null);
    setParseError(null);
    setMapping({});
    setDryRunResult(null);
    setDuplicateActions({});
  }, []);

  const handleFile = useCallback(
    async (selected: File) => {
      setParseError(null);
      setParsed(null);
      setDryRunResult(null);
      setMapping({});
      setDuplicateActions({});
      setFile(selected);
      try {
        const result = await parseImportFile(selected);
        setParsed(result);
        if (withMapper && targets) {
          // Auto-map columns whose header exactly matches a target value/label token.
          const auto: Record<string, string> = {};
          result.headers.forEach((header) => {
            const normalized = header.trim().toLowerCase();
            const match = targets.find(
              (t) => t.value.toLowerCase() === normalized || t.label.toLowerCase().includes(`(${normalized})`)
            );
            if (match) auto[header] = match.value;
          });
          setMapping(auto);
        }
      } catch (err) {
        const message = err instanceof ImportParseError ? err.message : getErrorMessage(err);
        setParseError(message);
        setFile(null);
      }
    },
    [withMapper, targets]
  );

  const dryRunMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Nenhum arquivo selecionado.");
      if (entity === "leads") return apiClient.importLeadsFile(file, mapping, true);
      if (entity === "deals") return apiClient.importDealsFile(file, true);
      return apiClient.importInteractionsFile(file, true);
    },
    onSuccess: (result) => {
      setDryRunResult(result);
      // Default every duplicate to "skip".
      const defaults: Record<string, ImportDuplicateAction> = {};
      (result.duplicates ?? []).forEach((dup) => {
        defaults[String(dup.row)] = "skip";
      });
      setDuplicateActions(defaults);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Nenhum arquivo selecionado.");
      if (entity === "leads") return apiClient.importLeadsFile(file, mapping, false, { duplicateActions });
      if (entity === "deals") return apiClient.importDealsFile(file, false);
      return apiClient.importInteractionsFile(file, false);
    },
    onSuccess: (result) => {
      setConfirmOpen(false);
      if (result.async && result.batchId) {
        toast.success("Importação iniciada. Acompanhe o progresso no histórico abaixo.");
      } else {
        toast.success(
          `Importação concluída: ${result.newCount} novo(s), ${result.duplicateCount} duplicata(s), ${result.errorCount} erro(s).`
        );
      }
      resetAll();
      onImported();
    },
    onError: (err) => {
      setConfirmOpen(false);
      toast.error(getErrorMessage(err));
    },
  });

  // Email is required for every entity; warn if leads mapping lacks it.
  const emailMapped = useMemo(
    () => Object.values(mapping).includes("email"),
    [mapping]
  );

  const previewRows = parsed?.rows.slice(0, PREVIEW_ROW_COUNT) ?? [];

  // For the leads preview, show mapped VYD fields; otherwise show file columns.
  const previewTargets = useMemo(() => {
    if (!withMapper || !targets) return [];
    // Preserve target order, only the ones actually mapped.
    const mappedValues = new Set(Object.values(mapping).filter((v) => v && v !== IGNORE_VALUE));
    return targets.filter((t) => mappedValues.has(t.value));
  }, [withMapper, targets, mapping]);

  /** Resolve a preview cell for a mapped target by reverse-looking-up the column. */
  const cellForTarget = useCallback(
    (row: Record<string, string>, targetValue: string): string => {
      const column = Object.keys(mapping).find((col) => mapping[col] === targetValue);
      return column ? (row[column] ?? "") : "";
    },
    [mapping]
  );

  return (
    <div className="space-y-5">
      {/* Required columns hint for fixed-schema entities */}
      {!withMapper && requiredColumns && (
        <Alert>
          <FileSpreadsheet />
          <AlertTitle>Colunas esperadas no CSV</AlertTitle>
          <AlertDescription>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {requiredColumns.map((col) => (
                <code key={col} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-gray-700">
                  {col}
                </code>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Dropzone
        file={file}
        onFile={handleFile}
        onClear={resetAll}
        disabled={dryRunMutation.isPending || importMutation.isPending}
      />

      {parseError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Não foi possível processar o arquivo</AlertTitle>
          <AlertDescription>{parseError}</AlertDescription>
        </Alert>
      )}

      {parsed && (
        <>
          <p className="text-sm text-gray-500">
            {parsed.rowCount.toLocaleString("pt-BR")} linha(s) detectada(s) • {parsed.headers.length} coluna(s)
          </p>

          {/* Column mapping table (reqs 5, 6) — leads only */}
          {withMapper && targets && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700">Mapeamento de colunas</h3>
              <ColumnMapper
                fileColumns={parsed.headers}
                targets={targets}
                mapping={mapping}
                onChange={(column, value) =>
                  setMapping((prev) => ({ ...prev, [column]: value }))
                }
              />
              {!emailMapped && (
                <p className="flex items-center gap-1.5 text-xs text-amber-600">
                  <TriangleAlert size={14} />
                  Mapeie uma coluna para o campo <strong>Email</strong> — ele é usado para detectar duplicatas.
                </p>
              )}
            </div>
          )}

          {/* Preview of first 5 rows reflecting the mapping (req 7) */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700">Pré-visualização (primeiras {PREVIEW_ROW_COUNT} linhas)</h3>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    {withMapper
                      ? previewTargets.length > 0
                        ? previewTargets.map((t) => <TableHead key={t.value}>{t.label}</TableHead>)
                        : <TableHead className="text-gray-400">Nenhuma coluna mapeada</TableHead>
                      : parsed.headers.map((h) => <TableHead key={h}>{h}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, rowIdx) => (
                    <TableRow key={rowIdx}>
                      {withMapper
                        ? previewTargets.length > 0
                          ? previewTargets.map((t) => (
                              <TableCell key={t.value} className="text-sm">{cellForTarget(row, t.value)}</TableCell>
                            ))
                          : <TableCell className="text-gray-300">—</TableCell>
                        : parsed.headers.map((h) => (
                            <TableCell key={h} className="text-sm">{row[h] ?? ""}</TableCell>
                          ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Analyze (dry-run) action */}
          <div className="flex items-center gap-2">
            <Button
              onClick={() => dryRunMutation.mutate()}
              disabled={dryRunMutation.isPending || (withMapper && !emailMapped)}
            >
              {dryRunMutation.isPending && <Loader2 size={16} className="mr-2 animate-spin" />}
              Analisar importação
            </Button>
            {dryRunResult && (
              <span className="text-xs text-gray-500">Revise o resultado abaixo antes de confirmar.</span>
            )}
          </div>

          {/* Dry-run preview (reqs 13-15) */}
          {dryRunResult && (
            <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
              <DryRunPreview
                result={dryRunResult}
                duplicateActions={duplicateActions}
                onDuplicateAction={(key, action) =>
                  setDuplicateActions((prev) => ({ ...prev, [key]: action }))
                }
                showDuplicateActions={withMapper}
              />

              {/* Explicit confirmation before final import (req 16) */}
              <div className="mt-4 flex items-center justify-end gap-2 border-t border-gray-200 pt-4">
                <Button variant="outline" onClick={resetAll} disabled={importMutation.isPending}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => setConfirmOpen(true)}
                  disabled={importMutation.isPending || dryRunResult.newCount + (withMapper ? Object.values(duplicateActions).filter((a) => a === "update").length : 0) === 0}
                >
                  Confirmar importação
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Final confirmation dialog (req 16) */}
      <AlertDialog open={confirmOpen} onOpenChange={(open) => !importMutation.isPending && setConfirmOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar importação</AlertDialogTitle>
            <AlertDialogDescription>
              {dryRunResult && (
                <>
                  Serão importados <strong>{dryRunResult.newCount}</strong> registro(s) novo(s)
                  {withMapper && (
                    <>
                      {" "}e atualizados{" "}
                      <strong>{Object.values(duplicateActions).filter((a) => a === "update").length}</strong>{" "}
                      registro(s) existente(s)
                    </>
                  )}
                  . {dryRunResult.errorCount > 0 && `${dryRunResult.errorCount} linha(s) com erro serão ignoradas. `}
                  Esta ação grava os dados no seu CRM.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={importMutation.isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                importMutation.mutate();
              }}
              disabled={importMutation.isPending}
            >
              {importMutation.isPending && <Loader2 size={16} className="mr-2 animate-spin" />}
              Importar agora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Import history + rollback — spec reqs 22, 26, 31
// ──────────────────────────────────────────────────────────

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

function isWithin24h(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < TWENTY_FOUR_HOURS_MS;
}

function ImportHistory() {
  const queryClient = useQueryClient();
  const [rollbackTarget, setRollbackTarget] = useState<ImportBatch | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["import-batches"],
    queryFn: () => apiClient.getImportBatches(),
    // Poll while any batch is still in progress (req 31).
    refetchInterval: (query) => {
      const batches = query.state.data?.batches ?? [];
      const pending = batches.some((b) => b.status === "PENDING" || b.status === "PROCESSING");
      return pending ? 4000 : false;
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: (batchId: string) => apiClient.rollbackImportBatch(batchId),
    onSuccess: () => {
      toast.success("Importação desfeita com sucesso.");
      setRollbackTarget(null);
      queryClient.invalidateQueries({ queryKey: ["import-batches"] });
    },
    onError: (err) => {
      setRollbackTarget(null);
      toast.error(getErrorMessage(err));
    },
  });

  const batches = data?.batches ?? [];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-300">
      <div className="flex items-center gap-2 border-b border-gray-200 p-4 md:p-6">
        <HistoryIcon size={18} className="text-gray-500" />
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Histórico de Importações</h2>
          <p className="text-sm text-gray-500">Acompanhe o status e desfaça importações recentes.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 p-6 text-sm text-gray-500">
          <Loader2 size={16} className="animate-spin" />
          Carregando histórico...
        </div>
      ) : batches.length === 0 ? (
        <div className="p-10 text-center text-sm text-gray-500">Nenhuma importação realizada ainda.</div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead className="text-right">Total de registros</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map((batch) => {
                const canRollback =
                  batch.status !== "ROLLED_BACK" &&
                  batch.status !== "PENDING" &&
                  batch.status !== "PROCESSING" &&
                  isWithin24h(batch.createdAt);
                return (
                  <TableRow key={batch.id}>
                    <TableCell className="text-sm text-gray-700">
                      {new Date(batch.createdAt).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-sm">{TYPE_LABELS[batch.type]}</TableCell>
                    <TableCell className="text-sm text-gray-700">{batch.user?.name ?? "—"}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{batch.totalRows}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={batch.status} />
                        {(batch.status === "PENDING" || batch.status === "PROCESSING") && (
                          <Loader2 size={14} className="animate-spin text-blue-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {canRollback ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-amber-700 hover:text-amber-800"
                          onClick={() => setRollbackTarget(batch)}
                          disabled={rollbackMutation.isPending}
                        >
                          <RotateCcw size={14} className="mr-1" />
                          Desfazer
                        </Button>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Rollback confirmation */}
      <AlertDialog open={!!rollbackTarget} onOpenChange={(open) => !open && setRollbackTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desfazer importação?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os registros criados nesta importação ({rollbackTarget ? TYPE_LABELS[rollbackTarget.type] : ""}) serão
              removidos. Esta ação só está disponível nas primeiras 24 horas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rollbackMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={(e) => {
                e.preventDefault();
                if (rollbackTarget) rollbackMutation.mutate(rollbackTarget.id);
              }}
              disabled={rollbackMutation.isPending}
            >
              {rollbackMutation.isPending && <Loader2 size={16} className="mr-2 animate-spin" />}
              Desfazer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────

export function Import() {
  const queryClient = useQueryClient();
  const { fields } = useCustomFields();

  // Lead targets = base fields + tenant custom fields (req 6).
  // The target value is the custom field's NAME so it matches the backend's
  // custom-field Set (keyed by name) and actually persists into Lead.customFields
  // (Gap 5). Using cf_<id> here would be silently dropped server-side.
  const leadTargets = useMemo<MappingTarget[]>(() => {
    const customTargets = fields.map((field) => ({
      value: field.name,
      label: `${field.name} (campo customizado)`,
    }));
    return [...LEAD_BASE_TARGETS, ...customTargets];
  }, [fields]);

  const refreshHistory = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["import-batches"] });
  }, [queryClient]);

  return (
    <div className="min-h-screen">
      <Header title="Importar Dados" subtitle="Migre leads, deals e interações a partir de CSV ou Excel" />

      <div className="p-4 md:p-8 space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-300 p-4 md:p-6">
          <Tabs defaultValue="leads">
            <TabsList className="mb-4">
              <TabsTrigger value="leads">
                <Users size={16} className="mr-1.5" />
                Leads
              </TabsTrigger>
              <TabsTrigger value="deals">Deals</TabsTrigger>
              <TabsTrigger value="interactions">Interações</TabsTrigger>
            </TabsList>

            <TabsContent value="leads">
              <ImportPanel entity="leads" targets={leadTargets} withMapper onImported={refreshHistory} />
            </TabsContent>
            <TabsContent value="deals">
              <ImportPanel
                entity="deals"
                requiredColumns={DEAL_COLUMNS}
                withMapper={false}
                onImported={refreshHistory}
              />
            </TabsContent>
            <TabsContent value="interactions">
              <ImportPanel
                entity="interactions"
                requiredColumns={INTERACTION_COLUMNS}
                withMapper={false}
                onImported={refreshHistory}
              />
            </TabsContent>
          </Tabs>
        </div>

        <ImportHistory />
      </div>
    </div>
  );
}
