import { getScoreLabel } from "../utils/leadScoring";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Info } from "lucide-react";

interface LeadScoreBadgeProps {
  score: number;
  showDetails?: boolean;
  factors?: Array<{ type: string; description: string; points: number }>;
}

export function LeadScoreBadge({ score, showDetails = false, factors }: LeadScoreBadgeProps) {
  const { label, color } = getScoreLabel(score);

  if (showDetails && factors) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-help ${color}`}>
              <span>{label}</span>
              <span className="font-bold">({score})</span>
              <Info size={12} />
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="space-y-2">
              <p className="font-medium">Score: {score} pontos</p>
              <div className="space-y-1">
                {factors.map((factor, index) => (
                  <div key={index} className="text-xs">
                    <span className="font-medium">{factor.description}:</span>{" "}
                    <span className={factor.points > 0 ? "text-green-600" : "text-red-600"}>
                      {factor.points > 0 ? "+" : ""}{factor.points}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>
      <span>{label}</span>
      <span className="font-bold">({score})</span>
    </div>
  );
}


