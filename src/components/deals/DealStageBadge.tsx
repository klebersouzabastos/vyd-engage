import { DealStage } from '../../types';

const STAGE_CONFIG: Record<DealStage, { label: string; className: string }> = {
  QUALIFICATION: { label: 'Qualificação', className: 'badge-stage-qualification' },
  PROPOSAL: { label: 'Proposta', className: 'badge-stage-proposal' },
  NEGOTIATION: { label: 'Negociação', className: 'badge-stage-negotiation' },
  CLOSING: { label: 'Fechamento', className: 'badge-stage-closing' },
  WON: { label: 'Ganho', className: 'badge-stage-won' },
  LOST: { label: 'Perdido', className: 'badge-stage-lost' },
};

interface DealStageBadgeProps {
  stage: DealStage;
  size?: 'sm' | 'md';
}

export function DealStageBadge({ stage, size = 'sm' }: DealStageBadgeProps) {
  const config = STAGE_CONFIG[stage] || STAGE_CONFIG.QUALIFICATION;
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${config.className} ${sizeClasses}`}
    >
      <span className="sr-only">Stage: </span>
      {config.label}
    </span>
  );
}
