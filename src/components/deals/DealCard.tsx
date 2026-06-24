import { Deal } from "../../types";
import { User, Calendar } from "lucide-react";
import { formatCurrency } from "../../utils/format";
import { cn } from "../ui/utils";
import { DealAIScore } from "./DealAIScore";

function formatDate(date: string | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

interface DealCardProps {
  deal: Deal;
  onClick: () => void;
  onEdit: () => void;
  isStale?: boolean;
  isOverlay?: boolean;
}

export function DealCard({ deal, onClick, onEdit: _onEdit, isStale, isOverlay }: DealCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "relative bg-white rounded-lg border p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow select-none",
        isOverlay ? "shadow-lg border-primary ring-2 ring-primary/20" : "border-gray-200",
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-medium text-gray-900 truncate flex-1">{deal.name}</h4>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isStale && (
            <span className="text-[10px] font-semibold bg-red-100 text-red-700 rounded-full px-2 py-0.5">
              Em risco
            </span>
          )}
          {/* AI close-propensity gauge — display-only: renders the STORED score
              already on the deal, never triggers a per-card AI call (reqs 18, 35).
              Skipped on the drag ghost. */}
          {!isOverlay && (
            <DealAIScore value={deal.aiScore} factors={deal.aiScoreFactors} size="sm" />
          )}
        </div>
      </div>

      <p className="text-sm font-bold text-gray-800 mb-2">{formatCurrency(deal.value)}</p>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-3">
          {deal.lead && (
            <span className="truncate max-w-[100px]" title={deal.lead.name}>
              {deal.lead.name}
            </span>
          )}
        </div>
        <span className="text-gray-400">{deal.probability}%</span>
      </div>

      <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
        {deal.assignedUser && (
          <span className="flex items-center gap-1">
            <User size={10} />
            {deal.assignedUser.name.split(" ")[0]}
          </span>
        )}
        {deal.expectedCloseDate && (
          <span className="flex items-center gap-1 ml-auto">
            <Calendar size={10} />
            {formatDate(deal.expectedCloseDate)}
          </span>
        )}
      </div>
    </div>
  );
}
