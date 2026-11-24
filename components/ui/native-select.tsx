import type { ComponentProps } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function NativeSelect({ className, ...props }: ComponentProps<'select'>) {
  return (
    <span data-slot="native-select-wrapper" className="native-select-wrapper">
      <select data-slot="native-select" className={cn('ui-input native-select', className)} {...props} />
      <ChevronDown size={15} className="native-select-chevron" aria-hidden="true" />
    </span>
  );
}
