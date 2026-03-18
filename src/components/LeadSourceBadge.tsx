import { Facebook, Globe, Search } from "lucide-react";

interface LeadSourceBadgeProps {
  source: 'meta' | 'google' | 'organico' | 'manual';
}

const sourceConfig = {
  meta: {
    label: 'Meta Ads',
    icon: Facebook,
    className: 'bg-blue-50 text-blue-600 border-blue-200',
  },
  google: {
    label: 'Google Ads',
    icon: Search,
    className: 'bg-red-50 text-red-600 border-red-200',
  },
  organico: {
    label: 'Orgânico',
    icon: Globe,
    className: 'bg-green-50 text-green-600 border-green-200',
  },
  manual: {
    label: 'Manual',
    icon: Globe,
    className: 'bg-gray-50 text-gray-600 border-gray-200',
  },
};

export function LeadSourceBadge({ source }: LeadSourceBadgeProps) {
  const config = sourceConfig[source];
  const Icon = config.icon;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-xs ${config.className}`}>
      <Icon size={12} aria-hidden="true" />
      <span className="sr-only">Origem: </span>
      {config.label}
    </span>
  );
}
