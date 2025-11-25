import { LucideIcon } from "lucide-react";
import { Button } from "./ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  actionLabel, 
  onAction 
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-16 h-16 bg-[#F9FAFB] rounded-full flex items-center justify-center mb-4">
        <Icon size={32} className="text-[#6B7280]" />
      </div>
      <h3 className="text-[#1F2937] mb-2">{title}</h3>
      <p className="text-[#6B7280] text-center max-w-md mb-6">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="bg-[#2563EB] hover:bg-[#1E40AF]">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
