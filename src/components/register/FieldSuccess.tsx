import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '../ui/utils';

interface FieldSuccessProps {
  isValid?: boolean;
  touched?: boolean;
  className?: string;
}

export function FieldSuccess({ isValid = false, touched = false, className }: FieldSuccessProps) {
  if (!isValid || !touched) {
    return null;
  }

  return (
    <div
      className={cn('flex items-center gap-1.5 mt-1 text-sm text-green-600', className)}
      aria-hidden="true"
    >
      <CheckCircle2
        size={16}
        className="flex-shrink-0"
      />
      <span className="sr-only">Campo válido</span>
    </div>
  );
}

