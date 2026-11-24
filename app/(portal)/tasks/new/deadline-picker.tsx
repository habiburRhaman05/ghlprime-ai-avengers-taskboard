'use client';

import { useEffect, useState } from 'react';
import { format, startOfDay } from 'date-fns';
import { CalendarClock, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DAY_MS, localDeadlineIso, validDeadline } from '@/lib/rules';

export function DeadlinePicker({
  id, value, onChange, errorId, disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  errorId?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState<Date>();
  const [time, setTime] = useState('');
  const [validationTime, setValidationTime] = useState<number>();
  const [timezone, setTimezone] = useState('');
  const labelId = id + '-label';
  const valueId = id + '-value';
  const helpId = id + '-help';
  const timeErrorId = id + '-time-error';
  const firstDay = validationTime === undefined ? undefined : startOfDay(validationTime + DAY_MS);
  const selection = localDeadlineIso(day, time);
  const invalidTime = day && time && !selection;
  const tooSoon = selection && validationTime !== undefined && !validDeadline(selection, validationTime);
  const timeError = invalidTime ? 'Choose a valid time on this date.' : tooSoon ? 'Choose a date and time at least 24 hours from now.' : '';

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  function changeOpen(next: boolean) {
    if (next) {
      const selected = value ? new Date(value) : undefined;
      setDay(selected);
      setTime(selected ? format(selected, 'HH:mm') : '');
      setValidationTime(Date.now());
    }
    setOpen(next);
  }

  function apply() {
    const now = Date.now();
    if (!validDeadline(selection, now)) {
      setValidationTime(now);
      return;
    }
    onChange(selection);
    setOpen(false);
  }

  return (
    <div className="task-field">
      <label id={labelId} htmlFor={id}>Completion deadline</label>
      <Popover open={open} onOpenChange={changeOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="secondary"
            className="ui-input date-picker-trigger"
            data-empty={!value}
            aria-labelledby={labelId + ' ' + valueId}
            aria-describedby={errorId ? helpId + ' ' + errorId : helpId}
            aria-invalid={!!errorId || undefined}
            disabled={disabled}
          >
            <CalendarClock size={17} aria-hidden="true" />
            <span id={valueId}>{value ? format(new Date(value), 'PP · p') : 'Choose date and time'}</span>
            <ChevronDown size={15} className="date-picker-chevron" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          collisionPadding={12}
          aria-label="Choose deadline date and time"
          onOpenAutoFocus={event => event.preventDefault()}
        >
          <Calendar
            mode="single"
            required
            selected={day}
            defaultMonth={day ?? firstDay}
            startMonth={firstDay}
            disabled={firstDay ? { before: firstDay } : undefined}
            fixedWeeks
            autoFocus
            onSelect={setDay}
          />
          <div className="date-time-picker-controls">
            <label>
              Time
              <Input type="time" step={60} value={time} onChange={event => setTime(event.target.value)}
                aria-invalid={!!timeError || undefined} aria-describedby={timeError ? timeErrorId : undefined} />
            </label>
            {timeError && <p className="error" id={timeErrorId} role="status">{timeError}</p>}
            <div className="date-time-picker-actions">
              <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="button" disabled={!selection || !!timeError} onClick={apply}>Apply</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <small id={helpId}>Choose a time at least 24 hours after creating the task{timezone ? ' · ' + timezone : ''}.</small>
    </div>
  );
}
