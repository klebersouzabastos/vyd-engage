import { Facebook, Globe, Search, Mail, Phone, Users, Calendar, LucideIcon } from 'lucide-react';

interface LeadSourceBadgeProps {
  // Aceita tanto o vocabulário do formulário de captação (meta/google/organico/manual)
  // quanto os valores do enum LeadSource do backend (website/social_media/referral/...).
  source: string;
}

type SourceStyle = { label: string; icon: LucideIcon; className: string };

// Reusar SOMENTE combinações de classes já presentes (Tailwind v4 pré-compilado,
// sem JIT — classes novas não gerariam CSS). Ver [[tailwind-precompiled-css]].
const BLUE = 'bg-blue-50 text-blue-600 border-blue-200';
const RED = 'bg-red-50 text-red-600 border-red-200';
const GREEN = 'bg-green-50 text-green-600 border-green-200';
const GRAY = 'bg-gray-50 text-gray-600 border-gray-200';

const sourceConfig: Record<string, SourceStyle> = {
  // Vocabulário do formulário de captação
  meta: { label: 'Meta Ads', icon: Facebook, className: BLUE },
  google: { label: 'Google Ads', icon: Search, className: RED },
  organico: { label: 'Orgânico', icon: Globe, className: GREEN },
  manual: { label: 'Manual', icon: Globe, className: GRAY },
  // Vocabulário do enum LeadSource (backend), normalizado para lowercase
  website: { label: 'Website', icon: Globe, className: GREEN },
  social_media: { label: 'Redes Sociais', icon: Facebook, className: BLUE },
  referral: { label: 'Indicação', icon: Users, className: GRAY },
  email: { label: 'E-mail', icon: Mail, className: GRAY },
  phone: { label: 'Telefone', icon: Phone, className: GRAY },
  event: { label: 'Evento', icon: Calendar, className: GRAY },
  other: { label: 'Outro', icon: Globe, className: GRAY },
};

export function LeadSourceBadge({ source }: LeadSourceBadgeProps) {
  const key = (source || '').toLowerCase();
  // Fallback: qualquer source desconhecido vira um badge genérico em vez de quebrar.
  const config = sourceConfig[key] || {
    label: source || 'Origem',
    icon: Globe,
    className: GRAY,
  };
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-xs ${config.className}`}
    >
      <Icon size={12} aria-hidden="true" />
      <span className="sr-only">Origem: </span>
      {config.label}
    </span>
  );
}
