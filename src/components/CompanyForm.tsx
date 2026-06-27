import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Company, CompanySize } from '../types';
import { Loader2 } from 'lucide-react';
import { FieldError } from './register/FieldError';
import { companyFormSchema } from '../utils/validation/formSchemas';
import { useFormValidation } from '../hooks/useFormValidation';
import { useAutoFocus } from '../hooks/useFocusManagement';

const SIZE_OPTIONS: { value: CompanySize; label: string }[] = [
  { value: 'MICRO', label: 'Micro' },
  { value: 'SMALL', label: 'Pequena' },
  { value: 'MEDIUM', label: 'Media' },
  { value: 'LARGE', label: 'Grande' },
  { value: 'ENTERPRISE', label: 'Enterprise' },
];

interface CompanyFormProps {
  company?: Company | null;
  onSave: (data: Partial<Company>) => Promise<void>;
  onCancel: () => void;
}

export function CompanyForm({ company, onSave, onCancel }: CompanyFormProps) {
  const [name, setName] = useState(company?.name || '');
  const [domain, setDomain] = useState(company?.domain || '');
  const [industry, setIndustry] = useState(company?.industry || '');
  const [size, setSize] = useState<CompanySize | ''>(company?.size || '');
  const [phone, setPhone] = useState(company?.phone || '');
  const [address, setAddress] = useState(company?.address || '');
  const [website, setWebsite] = useState(company?.website || '');
  const [notes, setNotes] = useState(company?.notes || '');
  const [saving, setSaving] = useState(false);
  const { fieldErrors, touchedFields, handleBlur, handleChange, validateAll, formRef } =
    useFormValidation({ schema: companyFormSchema });
  const autoFocusRef = useAutoFocus<HTMLFormElement>();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isValid = validateAll({
      name,
      domain,
      industry,
      size,
      phone,
      address,
      website,
      notes,
    });
    if (!isValid) return;

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
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
      ref={(el) => {
        (formRef as React.MutableRefObject<HTMLFormElement | null>).current = el;
        (autoFocusRef as React.MutableRefObject<HTMLFormElement | null>).current = el;
      }}
      noValidate
    >
      <div>
        <Label htmlFor="company-name">Nome *</Label>
        <Input
          id="company-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            handleChange('name', e.target.value);
          }}
          onBlur={() => handleBlur('name', name)}
          placeholder="Nome da empresa"
          className="mt-1"
          error={touchedFields.name ? fieldErrors.name : undefined}
          aria-describedby={
            fieldErrors.name && touchedFields.name ? 'company-name-error' : undefined
          }
        />
        <FieldError
          id="company-name-error"
          error={fieldErrors.name as string}
          touched={touchedFields.name}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="company-domain">Dominio</Label>
          <Input
            id="company-domain"
            value={domain}
            onChange={(e) => {
              setDomain(e.target.value);
              handleChange('domain', e.target.value);
            }}
            onBlur={() => handleBlur('domain', domain)}
            placeholder="exemplo.com.br"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="company-industry">Industria</Label>
          <Input
            id="company-industry"
            value={industry}
            onChange={(e) => {
              setIndustry(e.target.value);
              handleChange('industry', e.target.value);
            }}
            onBlur={() => handleBlur('industry', industry)}
            placeholder="Tecnologia, Saude..."
            className="mt-1"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="company-size">Porte</Label>
          <Select value={size} onValueChange={(v) => setSize(v as CompanySize)}>
            <SelectTrigger id="company-size" className="mt-1">
              <SelectValue placeholder="Selecione..." />
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
        <div>
          <Label htmlFor="company-phone">Telefone</Label>
          <Input
            id="company-phone"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              handleChange('phone', e.target.value);
            }}
            onBlur={() => handleBlur('phone', phone)}
            placeholder="(11) 99999-9999"
            className="mt-1"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="company-website">Website</Label>
        <Input
          id="company-website"
          value={website}
          onChange={(e) => {
            setWebsite(e.target.value);
            handleChange('website', e.target.value);
          }}
          onBlur={() => handleBlur('website', website)}
          placeholder="https://exemplo.com.br"
          className="mt-1"
          error={touchedFields.website ? fieldErrors.website : undefined}
          aria-describedby={
            fieldErrors.website && touchedFields.website ? 'company-website-error' : undefined
          }
        />
        <FieldError
          id="company-website-error"
          error={fieldErrors.website as string}
          touched={touchedFields.website}
        />
      </div>

      <div>
        <Label htmlFor="company-address">Endereco</Label>
        <Input
          id="company-address"
          value={address}
          onChange={(e) => {
            setAddress(e.target.value);
            handleChange('address', e.target.value);
          }}
          onBlur={() => handleBlur('address', address)}
          placeholder="Rua, Cidade, Estado"
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="company-notes">Notas</Label>
        <Textarea
          id="company-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Observacoes sobre a empresa..."
          rows={3}
          className="mt-1"
        />
      </div>

      <div className="flex items-center gap-2 justify-end pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 size={14} className="mr-2 animate-spin" />}
          {company ? 'Salvar' : 'Criar'}
        </Button>
      </div>
    </form>
  );
}
