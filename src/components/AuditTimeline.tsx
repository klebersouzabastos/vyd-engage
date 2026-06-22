import { useEffect, useState } from "react";
import { Loader2, User } from "lucide-react";

interface AuditChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

interface AuditLog {
  id: string;
  action: string;
  changes: AuditChange[];
  createdAt: string;
  user: { name: string; email: string };
}

const FIELD_LABELS: Record<string, string> = {
  name: "Nome",
  email: "E-mail",
  phone: "Telefone",
  status: "Status",
  score: "Score",
  company: "Empresa",
  position: "Cargo",
  notes: "Notas",
  assignedTo: "Responsável",
  stage: "Etapa",
  value: "Valor",
  probability: "Probabilidade",
  expectedCloseDate: "Fechamento previsto",
};

const ACTION_LABELS: Record<string, string> = {
  create: "Criou o registro",
  update: "Atualizou",
  delete: "Removeu o registro",
};

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? window.location.origin
    : "http://localhost:3001");

interface AuditTimelineProps {
  entityType: "lead" | "deal";
  entityId: string;
}

export function AuditTimeline({ entityType, entityId }: AuditTimelineProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!entityId) return;
    const load = async () => {
      try {
        setLoading(true);
        const endpoint = `${API_BASE}/api/v1/${entityType}s/${entityId}/audit`;
        const res = await fetch(endpoint, { credentials: "include" });
        const data = await res.json();
        setLogs(data?.data?.logs || []);
      } catch {
        setLogs([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [entityType, entityId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-400">
        Nenhuma alteração registrada.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {logs.map((log) => (
        <div key={log.id} className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <User size={14} className="text-gray-500" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-gray-900">
                {log.user?.name || "Sistema"}
              </span>
              <span className="text-xs text-gray-400 flex-shrink-0">
                {new Date(log.createdAt).toLocaleString("pt-BR")}
              </span>
            </div>
            {log.changes && log.changes.length > 0 ? (
              <div className="mt-1.5 space-y-1">
                {log.changes.map((c, i) => (
                  <div
                    key={i}
                    className="text-xs bg-gray-50 rounded px-2 py-1 text-gray-600"
                  >
                    <span className="font-medium text-gray-700">
                      {FIELD_LABELS[c.field] || c.field}
                    </span>
                    {": "}
                    <span className="line-through text-red-400">
                      {String(c.oldValue ?? "—")}
                    </span>
                    {" → "}
                    <span className="text-green-600 font-medium">
                      {String(c.newValue ?? "—")}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 mt-0.5">
                {ACTION_LABELS[log.action] || log.action}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
