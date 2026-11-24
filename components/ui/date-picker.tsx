'use client';

import { useState } from 'react';
import { format, startOfDay } from 'date-fns';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { Button } from './button';
import { Calendar } from './calendar';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

export function DatePicker({
  id, value, onChange, earliestDay, describedBy, invalid, disabled,
}: {
  id: string;
  value?: Date;
  onChange: (value: Date) => void;
  earliestDay?: Date;
  describedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const firstDay = earliestDay && startOfDay(earliestDay);
  const displayDate = value ? format(value, 'PPP') : 'Pick a date';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="secondary"
          className="ui-input date-picker-trigger"
          data-empty={!value}
          aria-label={value ? 'Date, ' + displayDate : displayDate}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          disabled={disabled}
        >
          <CalendarDays size={17} aria-hidden="true" />
          <span>{displayDate}</span>
          <ChevronDown size={15} className="date-picker-chevron" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={12}
        aria-label="Choose a date"
        onOpenAutoFocus={event => event.preventDefault()}
      >
        <Calendar
          mode="single"
          required
          selected={value}
          defaultMonth={value ?? firstDay}
          startMonth={firstDay}
          disabled={firstDay ? { before: firstDay } : undefined}
          fixedWeeks
          autoFocus
          onSelect={day => {
            onChange(day);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
