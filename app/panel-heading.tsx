import type { LucideIcon } from 'lucide-react';

export function PanelHeading({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <header className="form-section-title">
      <span className="form-section-icon"><Icon size={18} aria-hidden="true" /></span>
      <h2>{title}</h2>
    </header>
  );
}
