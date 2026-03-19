import { useState } from "react";
import { toast } from "sonner";
import { Deal, DealStage } from "../../types";
import { DealCard } from "./DealCard";
import { formatCurrency } from "../../utils/format";
import type { DealFunnelColumn, PipelineDeal } from "../../hooks/useDealsPipeline";

// Fallback stages used when no funnel columns are provided (legacy mode)
const PIPELINE_STAGES: { stage: DealStage; label: string; color: string }[] = [
  { stage: "QUALIFICATION", label: "Qualificação", color: "var(--color-stage-qualification-accent)" },
  { stage: "PROPOSAL", label: "Proposta", color: "var(--color-stage-proposal-accent)" },
  { stage: "NEGOTIATION", label: "Negociação", color: "var(--color-stage-negotiation-accent)" },
  { stage: "CLOSING", label: "Fechamento", color: "var(--color-stage-closing-accent)" },
];

interface DealPipelineBoardProps {
  deals: Deal[];
  onStageChange: (dealId: string, stage: DealStage) => Promise<void>;
  onEdit: (deal: Deal) => void;
  onClick: (deal: Deal) => void;
  // New: funnel-based pipeline
  funnelColumns?: DealFunnelColumn[];
  onMoveDeal?: (dealId: string, targetColumnId: string, position: number) => Promise<void>;
}

export function DealPipelineBoard({ deals, onStageChange, onEdit, onClick, funnelColumns, onMoveDeal }: DealPipelineBoardProps) {
  const [draggedDeal, setDraggedDeal] = useState<Deal | PipelineDeal | null>(null);
  const [draggedFromColumnId, setDraggedFromColumnId] = useState<string | null>(null);

  // Use funnel columns if available, otherwise fall back to enum-based stages
  const useFunnelMode = !!funnelColumns && funnelColumns.length > 0;

  const wonDeals = deals.filter(d => d.stage === "WON");
  const lostDeals = deals.filter(d => d.stage === "LOST");
  const wonTotal = wonDeals.reduce((s, d) => s + d.value, 0);
  const lostTotal = lostDeals.reduce((s, d) => s + d.value, 0);

  const handleDragStart = (deal: Deal | PipelineDeal, columnId?: string) => {
    setDraggedDeal(deal);
    setDraggedFromColumnId(columnId || null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  // Funnel-mode drop handler
  const handleDropFunnel = async (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    if (!draggedDeal || !onMoveDeal) {
      setDraggedDeal(null);
      setDraggedFromColumnId(null);
      return;
    }

    if (draggedFromColumnId === targetColumnId) {
      setDraggedDeal(null);
      setDraggedFromColumnId(null);
      return;
    }

    const targetColumn = funnelColumns?.find(c => c.id === targetColumnId);
    const position = targetColumn ? targetColumn.deals.length : 0;

    try {
      await onMoveDeal(draggedDeal.id, targetColumnId, position);
    } catch {
      toast.error("Erro ao mover deal. Tente novamente.");
    } finally {
      setDraggedDeal(null);
      setDraggedFromColumnId(null);
    }
  };

  // Legacy drop handler (enum-based)
  const handleDropLegacy = async (e: React.DragEvent, targetStage: DealStage) => {
    e.preventDefault();
    if (!draggedDeal || (draggedDeal as Deal).stage === targetStage) {
      setDraggedDeal(null);
      return;
    }
    try {
      await onStageChange(draggedDeal.id, targetStage);
    } catch {
      toast.error("Erro ao mover deal. Tente novamente.");
    } finally {
      setDraggedDeal(null);
    }
  };

  // Convert PipelineDeal to Deal-like for DealCard
  const pipelineDealToDeal = (d: PipelineDeal): Deal => ({
    id: d.id,
    tenantId: '',
    name: d.name,
    value: typeof d.value === 'number' ? d.value : Number(d.value),
    stage: (d.stage as DealStage) || 'QUALIFICATION',
    probability: d.probability,
    expectedCloseDate: d.expectedCloseDate,
    leadId: d.leadId,
    lead: d.lead ? { ...d.lead, phone: undefined, company: undefined } : null,
    assignedTo: d.assignedTo,
    assignedUser: d.assignedUser || null,
    notes: d.notes,
    customFields: {},
    lostReason: d.lostReason,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  });

  if (useFunnelMode) {
    // Compute won/lost from funnel columns deals
    const allColumnDeals = funnelColumns!.flatMap(c => c.deals);
    const funnelWonTotal = allColumnDeals.filter(d => d.stage === 'WON').reduce((s, d) => s + Number(d.value), 0);
    const funnelLostTotal = allColumnDeals.filter(d => d.stage === 'LOST').reduce((s, d) => s + Number(d.value), 0);
    const funnelWonCount = allColumnDeals.filter(d => d.stage === 'WON').length;
    const funnelLostCount = allColumnDeals.filter(d => d.stage === 'LOST').length;

    return (
      <div>
        {/* WON / LOST summary */}
        <div className="flex gap-4 mb-4">
          <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
            <span className="text-sm font-medium text-green-700">Ganhos ({funnelWonCount})</span>
            <span className="text-sm font-bold text-green-700">{formatCurrency(funnelWonTotal)}</span>
          </div>
          <div className="flex-1 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between">
            <span className="text-sm font-medium text-red-700">Perdidos ({funnelLostCount})</span>
            <span className="text-sm font-bold text-red-700">{formatCurrency(funnelLostTotal)}</span>
          </div>
        </div>

        {/* Kanban Board with Funnel Columns */}
        <div className="flex gap-4 overflow-x-auto pb-4">
          {funnelColumns!.map((column) => {
            const columnDeals = column.deals;
            const columnTotal = columnDeals.reduce((s, d) => s + Number(d.value), 0);

            return (
              <div
                key={column.id}
                className="flex-shrink-0 w-72 bg-gray-50 rounded-lg border border-gray-200"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropFunnel(e, column.id)}
              >
                {/* Column header */}
                <div className="p-3 border-b border-gray-200">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: column.color }} />
                    <span className="text-sm font-semibold text-gray-900">{column.title}</span>
                    <span className="ml-auto text-xs text-gray-500 bg-gray-200 rounded-full px-2 py-0.5">
                      {columnDeals.length}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">{formatCurrency(columnTotal)}</span>
                </div>

                {/* Cards */}
                <div className="p-2 space-y-2 min-h-[200px]">
                  {columnDeals.map(deal => {
                    const dealAsDeal = pipelineDealToDeal(deal);
                    return (
                      <DealCard
                        key={deal.id}
                        deal={dealAsDeal}
                        onDragStart={() => handleDragStart(deal, column.id)}
                        onClick={() => onClick(dealAsDeal)}
                        onEdit={() => onEdit(dealAsDeal)}
                      />
                    );
                  })}
                  {columnDeals.length === 0 && (
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

  // Legacy enum-based board (fallback)
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
              onDrop={(e) => handleDropLegacy(e, stage)}
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
