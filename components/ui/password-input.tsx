'use client';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from './input';

export function PasswordInput(props: Omit<React.ComponentProps<'input'>, 'type'>) {
  const [visible, setVisible] = useState(false);
  return <span className="password-field">
    <Input {...props} type={visible ? 'text' : 'password'} />
    <button type="button" className="password-toggle" aria-label={visible ? 'Hide password' : 'Show password'}
      aria-pressed={visible} onClick={() => setVisible(!visible)}>
      {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
    </button>
  </span>;
}
