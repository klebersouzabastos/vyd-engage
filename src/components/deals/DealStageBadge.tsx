import { DealStage } from "../../types";

const STAGE_CONFIG: Record<DealStage, { label: string; bg: string; text: string }> = {
  QUALIFICATION: { label: "Qualificação", bg: "bg-blue-100", text: "text-blue-700" },
  PROPOSAL: { label: "Proposta", bg: "bg-yellow-100", text: "text-yellow-700" },
  NEGOTIATION: { label: "Negociação", bg: "bg-orange-100", text: "text-orange-700" },
  CLOSING: { label: "Fechamento", bg: "bg-purple-100", text: "text-purple-700" },
  WON: { label: "Ganho", bg: "bg-green-100", text: "text-green-700" },
  LOST: { label: "Perdido", bg: "bg-red-100", text: "text-red-700" },
};

interface DealStageBadgeProps {
  stage: DealStage;
  size?: "sm" | "md";
}

export function DealStageBadge({ stage, size = "sm" }: DealStageBadgeProps) {
  const config = STAGE_CONFIG[stage] || STAGE_CONFIG.QUALIFICATION;
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${config.bg} ${config.text} ${sizeClasses}`}>
      <span className="sr-only">Stage: </span>
      {config.label}
    </span>
  );
}
