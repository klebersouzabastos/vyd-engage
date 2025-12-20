import { X } from "lucide-react";
import { Tag } from "../types";

interface TagBadgeProps {
  tag: Tag;
  onRemove?: () => void;
  size?: "sm" | "md" | "lg";
  showRemove?: boolean;
}

export function TagBadge({
  tag,
  onRemove,
  size = "md",
  showRemove = false,
}: TagBadgeProps) {
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5",
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-full font-medium
        ${sizeClasses[size]}
      `}
      style={{
        backgroundColor: `${tag.color}20`,
        color: tag.color,
        border: `1px solid ${tag.color}40`,
      }}
      title={tag.name}
    >
      {tag.name}
      {showRemove && onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 hover:opacity-70 transition-opacity"
          aria-label={`Remover tag ${tag.name}`}
        >
          <X size={12} />
        </button>
      )}
    </span>
  );
}








