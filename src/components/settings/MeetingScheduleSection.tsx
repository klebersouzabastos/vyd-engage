import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Loader2, Plus, Trash2, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const API_BASE = import.meta.env.VITE_API_URL || (
  typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? window.location.origin
    : 'http://localhost:3001'
);

interface AvailabilityItem {
  id: string;
  slug: string;
  title: string;
  duration: number;
}

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API_BASE}${path}`, {
    ...opts,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts?.headers as object) },
  });
  return r.json();
}

export function MeetingScheduleSection() {
  const [items, setItems] = useState<AvailabilityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("Reunião de 30 minutos");
  const [duration, setDuration] = useState(30);

  const load = () => {
    setLoading(true);
    apiFetch('/api/v1/schedule')
      .then(d => setItems(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!title.trim()) { toast.error("Informe um título"); return; }
    setCreating(true);
    try {
      const r = await apiFetch('/api/v1/schedule', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          duration,
          availableHours: {
            mon: [{ start: "09:00", end: "17:00" }],
            tue: [{ start: "09:00", end: "17:00" }],
            wed: [{ start: "09:00", end: "17:00" }],
            thu: [{ start: "09:00", end: "17:00" }],
            fri: [{ start: "09:00", end: "17:00" }],
          },
        }),
      });
      if (r.status === 201) {
        toast.success("Link de agendamento criado");
        setShowForm(false);
        setTitle("Reunião de 30 minutos");
        setDuration(30);
        load();
      } else {
        toast.error(r.error || "Erro ao criar");
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este link de agendamento?")) return;
    await apiFetch(`/api/v1/schedule/${id}`, { method: 'DELETE' });
    setItems(prev => prev.filter(i => i.id !== id));
    toast.success("Link removido");
  };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/s/${slug}`;
    navigator.clipboard.writeText(url).then(() => toast.success("Link copiado!"));
  };

  return (
    <div className="p-4 rounded-lg border border-gray-300">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="font-medium text-gray-900 mb-1">Links de Agendamento</h4>
          <p className="text-sm text-gray-500">Crie links públicos para que leads agendem reuniões diretamente.</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1" onClick={() => setShowForm(v => !v)}>
          <Plus size={14} />{showForm ? "Cancelar" : "Novo link"}
        </Button>
      </div>

      {showForm && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Reunião de descoberta" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duração (minutos)</label>
            <Input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} min={5} max={480} />
          </div>
          <Button size="sm" onClick={handleCreate} disabled={creating} className="gap-2">
            {creating && <Loader2 size={14} className="animate-spin" />}Criar link
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 size={14} className="animate-spin" />Carregando…
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400">Nenhum link criado ainda.</p>
      ) : (
        <ul className="space-y-2">
          {items.map(item => (
            <li key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <p className="text-sm font-medium text-gray-800">{item.title}</p>
                <p className="text-xs text-gray-400">{item.duration} min · /s/{item.slug}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => copyLink(item.slug)} title="Copiar link">
                  <Copy size={14} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => window.open(`/s/${item.slug}`, '_blank')} title="Abrir página">
                  <ExternalLink size={14} />
                </Button>
                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={() => handleDelete(item.id)} title="Excluir">
                  <Trash2 size={14} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
