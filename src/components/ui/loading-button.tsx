import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { Button, buttonVariants, type VariantProps } from './button';
import { cn } from './utils';

interface LoadingButtonProps
  extends React.ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
  loadingText?: string;
}

function LoadingButton({
  className,
  variant,
  size,
  loading = false,
  loadingText,
  children,
  disabled,
  ...props
}: LoadingButtonProps) {
  return (
    <Button
      className={cn(className)}
      variant={variant}
      size={size}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
      {loading ? loadingText || children : children}
    </Button>
  );
}

export { LoadingButton };
