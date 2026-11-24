import * as React from 'react';
import { cn } from '@/lib/utils';

// The shadcn/ui input pattern, styled with the portal's CSS tokens.
export function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return <input type={type} data-slot="input" className={cn('ui-input', className)} {...props} />;
}
