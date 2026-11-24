import Link from 'next/link';
import { requireActor } from '@/lib/auth';
import { signOut } from '@/app/actions';
import { Brand } from '@/app/brand';
import { TopNavigation } from '@/app/top-navigation';
import { LogOut } from 'lucide-react';

const roleLabel = { super_admin: 'Super admin', client_admin: 'Client admin', agency_member: 'Agency member' };

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireActor();
  return (
    <div className="shell">
      <a className="skip-link" href="#workspace">Skip to content</a>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/dashboard" aria-label="GHL Prime Client Portal" className="brand-link"><Brand /></Link>
          <TopNavigation />
          <div className="topbar-account">
            <div className="account-identity">
              <span className="avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span>
              <span className="account-details"><strong>{user.name}</strong><small>{roleLabel[user.role]}</small></span>
            </div>
            <form action={signOut}>
              <button className="sign-out" type="submit"><LogOut size={16} aria-hidden="true" /><span>Sign out</span></button>
            </form>
          </div>
        </div>
      </header>
      <main className="workspace" id="workspace" tabIndex={-1}>{children}</main>
    </div>
  );
}
