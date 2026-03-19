import { useState, useEffect, useRef, useCallback } from "react";
import { Deal, DealStage } from "../../types";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Loader2, Search } from "lucide-react";
import { apiClient } from "../../services/api/client";

const STAGES: { value: DealStage; label: string }[] = [
  { value: "QUALIFICATION", label: "Qualificação" },
  { value: "PROPOSAL", label: "Proposta" },
  { value: "NEGOTIATION", label: "Negociação" },
  { value: "CLOSING", label: "Fechamento" },
  { value: "WON", label: "Ganho" },
  { value: "LOST", label: "Perdido" },
];

interface DealFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  deal?: Deal | null;
  defaultLeadId?: string;
  defaultFunnelId?: string;
}

export function DealForm({ open, onClose, onSave, deal, defaultLeadId, defaultFunnelId }: DealFormProps) {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [stage, setStage] = useState<DealStage>("QUALIFICATION");
  const [probability, setProbability] = useState("20");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [leadId, setLeadId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [notes, setNotes] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [funnelId, setFunnelId] = useState("");
  const [saving, setSaving] = useState(false);

  const [leads, setLeads] = useState<Array<{ id: string; name: string }>>([]);
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [dealFunnels, setDealFunnels] = useState<Array<{ id: string; name: string; isDefault: boolean }>>([]);
  const [leadSearch, setLeadSearch] = useState("");
  const [loadingLeads, setLoadingLeads] = useState(false);
  const leadSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchLeads = useCallback(async (search?: string) => {
    try {
      setLoadingLeads(true);
      const filters: any = { limit: 50 };
      if (search?.trim()) filters.search = search.trim();
      const res = await apiClient.getLeads(filters);
      setLeads(res.leads?.map((l: any) => ({ id: l.id, name: l.name })) || []);
    } catch {
      // silent
    } finally {
      setLoadingLeads(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      // Load leads (initial), users, and deal funnels for selects
      fetchLeads();
      apiClient.getUsers().then(res => {
        const userList = Array.isArray(res) ? res : res.data || [];
        setUsers(userList.map((u: any) => ({ id: u.id, name: u.name })));
      }).catch(() => {});
      apiClient.getFunnels('DEAL').then(res => {
        const funnelList: any[] = (res as any).data || res || [];
        setDealFunnels(funnelList.map((f: any) => ({ id: f.id, name: f.name, isDefault: f.isDefault })));
      }).catch(() => {});
    } else {
      setLeadSearch("");
    }
  }, [open, fetchLeads]);

  useEffect(() => {
    if (!open) return;
    if (leadSearchTimerRef.current) clearTimeout(leadSearchTimerRef.current);
    leadSearchTimerRef.current = setTimeout(() => {
      fetchLeads(leadSearch);
    }, 300);
    return () => {
      if (leadSearchTimerRef.current) clearTimeout(leadSearchTimerRef.current);
    };
  }, [leadSearch, open, fetchLeads]);

  useEffect(() => {
    if (deal) {
      setName(deal.name);
      setValue(String(deal.value));
      setStage(deal.stage);
      setProbability(String(deal.probability));
      setExpectedCloseDate(deal.expectedCloseDate ? deal.expectedCloseDate.split("T")[0] : "");
      setLeadId(deal.leadId || "");
      setAssignedTo(deal.assignedTo || "");
      setNotes(deal.notes || "");
      setLostReason(deal.lostReason || "");
      setFunnelId(deal.funnelId || "");
    } else {
      setName("");
      setValue("");
      setStage("QUALIFICATION");
      setProbability("20");
      setExpectedCloseDate("");
      setLeadId(defaultLeadId || "");
      setAssignedTo("");
      setNotes("");
      setLostReason("");
      setFunnelId(defaultFunnelId || "");
    }
  }, [deal, open, defaultLeadId, defaultFunnelId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !value) return;

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        value: parseFloat(value),
        stage,
        probability: parseInt(probability),
        expectedCloseDate: expectedCloseDate || undefined,
        leadId: leadId || null,
        assignedTo: assignedTo || null,
        notes: notes.trim() || undefined,
        lostReason: stage === "LOST" ? lostReason.trim() || undefined : undefined,
        funnelId: funnelId || null,
      });
      onClose();
    } catch {
      // Error handled by parent
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{deal ? "Editar Deal" : "Novo Deal"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="deal-name">Nome *</Label>
            <Input
              id="deal-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do negócio"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="deal-value">Valor (R$) *</Label>
              <Input
                id="deal-value"
                type="number"
                min="0"
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <Label htmlFor="deal-stage">Stage</Label>
              <Select value={stage} onValueChange={(v) => setStage(v as DealStage)}>
                <SelectTrigger id="deal-stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="deal-probability">Probabilidade (%)</Label>
              <Input
                id="deal-probability"
                type="number"
                min="0"
                max="100"
                value={probability}
                onChange={(e) => setProbability(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="deal-close-date">Data de Fechamento</Label>
              <Input
                id="deal-close-date"
                type="date"
                value={expectedCloseDate}
                onChange={(e) => setExpectedCloseDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="deal-lead">Lead Associado</Label>
              <Select value={leadId || "none"} onValueChange={(v) => setLeadId(v === "none" ? "" : v)}>
                <SelectTrigger id="deal-lead">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 pb-2">
                    <div className="relative">
                      <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                      <input
                        type="text"
                        placeholder="Buscar lead..."
                        value={leadSearch}
                        onChange={(e) => setLeadSearch(e.target.value)}
                        className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        aria-label="Buscar lead associado"
                      />
                    </div>
                  </div>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {loadingLeads ? (
                    <div className="flex items-center justify-center py-2">
                      <Loader2 size={14} className="animate-spin text-gray-400" />
                    </div>
                  ) : leads.length === 0 ? (
                    <div className="px-2 py-2 text-xs text-gray-500 text-center">
                      Nenhum lead encontrado
                    </div>
                  ) : (
                    leads.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="deal-assigned">Responsável</Label>
              <Select value={assignedTo || "none"} onValueChange={(v) => setAssignedTo(v === "none" ? "" : v)}>
                <SelectTrigger id="deal-assigned">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {dealFunnels.length > 0 && (
            <div>
              <Label htmlFor="deal-funnel">Pipeline</Label>
              <Select value={funnelId || "none"} onValueChange={(v) => setFunnelId(v === "none" ? "" : v)}>
                <SelectTrigger id="deal-funnel">
                  <SelectValue placeholder="Selecionar pipeline" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {dealFunnels.map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}{f.isDefault ? " (Padrão)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="deal-notes">Notas</Label>
            <Textarea
              id="deal-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações sobre o negócio..."
              rows={3}
            />
          </div>

          {stage === "LOST" && (
            <div>
              <Label htmlFor="deal-lost-reason">Motivo da Perda</Label>
              <Input
                id="deal-lost-reason"
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                placeholder="Por que o deal foi perdido?"
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !name.trim() || !value}>
              {saving && <Loader2 size={14} className="mr-2 animate-spin" />}
              {deal ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
