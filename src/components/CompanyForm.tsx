import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Company, CompanySize } from "../types";
import { Loader2 } from "lucide-react";

const SIZE_OPTIONS: { value: CompanySize; label: string }[] = [
  { value: "MICRO", label: "Micro" },
  { value: "SMALL", label: "Pequena" },
  { value: "MEDIUM", label: "Media" },
  { value: "LARGE", label: "Grande" },
  { value: "ENTERPRISE", label: "Enterprise" },
];

interface CompanyFormProps {
  company?: Company | null;
  onSave: (data: Partial<Company>) => Promise<void>;
  onCancel: () => void;
}

export function CompanyForm({ company, onSave, onCancel }: CompanyFormProps) {
  const [name, setName] = useState(company?.name || "");
  const [domain, setDomain] = useState(company?.domain || "");
  const [industry, setIndustry] = useState(company?.industry || "");
  const [size, setSize] = useState<CompanySize | "">(company?.size || "");
  const [phone, setPhone] = useState(company?.phone || "");
  const [address, setAddress] = useState(company?.address || "");
  const [website, setWebsite] = useState(company?.website || "");
  const [notes, setNotes] = useState(company?.notes || "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setSaving(true);
      await onSave({
        name: name.trim(),
        domain: domain.trim() || null,
        industry: industry.trim() || null,
        size: size || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        website: website.trim() || null,
        notes: notes.trim() || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome da empresa"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Dominio</label>
          <Input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="exemplo.com.br"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Industria</label>
          <Input
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="Tecnologia, Saude..."
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Porte</label>
          <Select value={size} onValueChange={(v) => setSize(v as CompanySize)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {SIZE_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(11) 99999-9999"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
        <Input
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="https://exemplo.com.br"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Endereco</label>
        <Input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Rua, Cidade, Estado"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Observacoes sobre a empresa..."
          rows={3}
        />
      </div>

      <div className="flex items-center gap-2 justify-end pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!name.trim() || saving}>
          {saving && <Loader2 size={14} className="mr-2 animate-spin" />}
          {company ? "Salvar" : "Criar"}
        </Button>
      </div>
    </form>
  );
}
