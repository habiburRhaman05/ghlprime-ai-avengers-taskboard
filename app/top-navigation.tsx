'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Settings2 } from 'lucide-react';

export function TopNavigation() {
  const path = usePathname();
  const inProjects = path === '/dashboard' || path.startsWith('/projects/') || path.startsWith('/tasks/');
  return <nav className="top-nav" aria-label="Main navigation">
    <Link href="/dashboard" aria-current={inProjects ? 'page' : undefined}><LayoutGrid size={17} aria-hidden="true" /> Projects</Link>
    <Link href="/settings" aria-current={path.startsWith('/settings') ? 'page' : undefined}><Settings2 size={17} aria-hidden="true" /> Settings</Link>
  </nav>;
}
