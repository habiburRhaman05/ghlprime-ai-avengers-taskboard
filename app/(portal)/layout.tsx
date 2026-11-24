import Link from 'next/link';
import { requireActor } from '@/lib/auth';
import { signOut } from '@/app/actions';
import { Brand } from '@/app/brand';
import { TopNavigation } from '@/app/top-navigation';
import { LogOut } from 'lucide-react';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireActor();
  return <div className="shell">
    <header className="topbar"><div className="topbar-inner">
      <Link href="/dashboard" className="brand-link"><Brand /></Link>
      <TopNavigation />
      <div className="topbar-account"><span className="avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span>
        <span className="account-details"><strong>{user.name}</strong><small>{({ super_admin: 'Super admin', client_admin: 'Client admin', agency_member: 'Agency member' })[user.role]}</small></span>
        <form action={signOut}><button className="sign-out" type="submit"><LogOut size={16} aria-hidden="true" /><span>Sign out</span></button></form>
      </div>
    </div></header>
    <main className="workspace">{children}</main>
  </div>;
}
