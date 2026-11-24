import Link from 'next/link';
import { ArrowLeft, FolderX } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="unavailable-page">
      <section className="card empty-state">
        <span className="empty-icon"><FolderX size={23} aria-hidden="true" /></span>
        <h1>Page unavailable</h1>
        <p>This page may have moved or require project access.</p>
        <Button asChild><Link href="/dashboard"><ArrowLeft size={16} aria-hidden="true" /> Back to projects</Link></Button>
      </section>
    </div>
  );
}
