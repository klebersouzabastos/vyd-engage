import { useState } from "react";
import { Deal, DealStage } from "../../types";
import { DealCard } from "./DealCard";

const PIPELINE_STAGES: { stage: DealStage; label: string; color: string }[] = [
  { stage: "QUALIFICATION", label: "Qualificação", color: "#3B82F6" },
  { stage: "PROPOSAL", label: "Proposta", color: "#EAB308" },
  { stage: "NEGOTIATION", label: "Negociação", color: "#F97316" },
  { stage: "CLOSING", label: "Fechamento", color: "#8B5CF6" },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

interface DealPipelineBoardProps {
  deals: Deal[];
  onStageChange: (dealId: string, stage: DealStage) => Promise<void>;
  onEdit: (deal: Deal) => void;
  onClick: (deal: Deal) => void;
}

export function DealPipelineBoard({ deals, onStageChange, onEdit, onClick }: DealPipelineBoardProps) {
  const [draggedDeal, setDraggedDeal] = useState<Deal | null>(null);

  const wonDeals = deals.filter(d => d.stage === "WON");
  const lostDeals = deals.filter(d => d.stage === "LOST");
  const wonTotal = wonDeals.reduce((s, d) => s + d.value, 0);
  const lostTotal = lostDeals.reduce((s, d) => s + d.value, 0);

  const handleDragStart = (deal: Deal) => {
    setDraggedDeal(deal);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetStage: DealStage) => {
    e.preventDefault();
    if (!draggedDeal || draggedDeal.stage === targetStage) {
      setDraggedDeal(null);
      return;
    }
    await onStageChange(draggedDeal.id, targetStage);
    setDraggedDeal(null);
  };

  return (
    <div>
      {/* WON / LOST summary */}
      <div className="flex gap-4 mb-4">
        <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm font-medium text-green-700">Ganhos ({wonDeals.length})</span>
          <span className="text-sm font-bold text-green-700">{formatCurrency(wonTotal)}</span>
        </div>
        <div className="flex-1 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm font-medium text-red-700">Perdidos ({lostDeals.length})</span>
          <span className="text-sm font-bold text-red-700">{formatCurrency(lostTotal)}</span>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map(({ stage, label, color }) => {
          const stageDeals = deals.filter(d => d.stage === stage);
          const stageTotal = stageDeals.reduce((s, d) => s + d.value, 0);

          return (
            <div
              key={stage}
              className="flex-shrink-0 w-72 bg-gray-50 rounded-lg border border-gray-200"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage)}
            >
              {/* Column header */}
              <div className="p-3 border-b border-gray-200">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-sm font-semibold text-gray-900">{label}</span>
                  <span className="ml-auto text-xs text-gray-500 bg-gray-200 rounded-full px-2 py-0.5">
                    {stageDeals.length}
                  </span>
                </div>
                <span className="text-xs text-gray-500">{formatCurrency(stageTotal)}</span>
              </div>

              {/* Cards */}
              <div className="p-2 space-y-2 min-h-[200px]">
                {stageDeals.map(deal => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    onDragStart={() => handleDragStart(deal)}
                    onClick={() => onClick(deal)}
                    onEdit={() => onEdit(deal)}
                  />
                ))}
                {stageDeals.length === 0 && (
                  <div className="flex items-center justify-center h-20 text-xs text-gray-400">
                    Arraste deals aqui
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
