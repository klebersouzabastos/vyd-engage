import React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '../ui/utils';

interface FieldErrorProps {
  id?: string;
  error?: string;
  touched?: boolean;
  className?: string;
}

export function FieldError({ id, error, touched = true, className }: FieldErrorProps) {
  if (!error || !touched) {
    return null;
  }

  return (
    <div
      id={id}
      className={cn('flex items-start gap-1.5 mt-1 text-sm text-red-600', className)}
      role="alert"
      aria-live="polite"
    >
      <AlertCircle
        size={16}
        className="flex-shrink-0 mt-0.5"
        aria-hidden="true"
      />
      <span>{error}</span>
    </div>
  );
}

