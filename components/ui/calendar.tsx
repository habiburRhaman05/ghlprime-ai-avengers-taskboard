'use client';

import { useEffect, useRef, type ComponentProps } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker, type DayButton } from 'react-day-picker';
import { Button } from './button';
import { cn } from '@/lib/utils';
import 'react-day-picker/style.css';
import './calendar.css';

// shadcn/ui Calendar, using the portal's CSS tokens for the DayPicker theme.
export function Calendar({
  className, components, showOutsideDays = true, ...props
}: ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      navLayout="around"
      className={cn('ui-calendar', className)}
      components={{
        Root: ({ rootRef, ...rootProps }) => <div data-slot="calendar" ref={rootRef} {...rootProps} />,
        Chevron: ({ orientation, className }) => {
          const Icon = orientation === 'left' ? ChevronLeft : orientation === 'right' ? ChevronRight : ChevronDown;
          return <Icon size={16} className={className} aria-hidden="true" />;
        },
        DayButton: CalendarDayButton,
        ...components,
      }}
      {...props}
    />
  );
}

function CalendarDayButton({ day, modifiers, ...props }: ComponentProps<typeof DayButton>) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return <Button ref={ref} variant="ghost" data-day={day.isoDate} {...props} />;
}
