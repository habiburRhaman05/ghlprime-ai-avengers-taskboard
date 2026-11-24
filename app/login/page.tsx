import { redirect } from 'next/navigation';
import { ArrowRight, LockKeyhole, Mail } from 'lucide-react';
import { login } from '@/app/actions';
import { ActionForm } from '@/app/components';
import { Brand } from '@/app/brand';
import { actor } from '@/lib/auth';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';

export const metadata = { title: 'Sign in' };
export default async function Login({ searchParams }: { searchParams: Promise<{ link?: string }> }) {
  const { link } = await searchParams;
  if (await actor()) redirect('/dashboard');
  return (
    <main className="login-shell">
      <div className="login-frame">
        <section className="login-card" aria-labelledby="sign-in-heading">
          <div className="login-brand"><Brand /></div>
          <div className="login-intro">
            <h1 id="sign-in-heading">Welcome back</h1>
            <p>Sign in to the GHL Prime Client Portal.</p>
          </div>
          {link === 'expired' && (
            <p role="alert" className="error">This account link is invalid or expired. Request a fresh link from your administrator.</p>
          )}
          <ActionForm
            action={login}
            submit="Sign in"
            submitIcon={<ArrowRight size={17} aria-hidden="true" />}
            className="stack login-form"
          >
            <div className="task-field">
              <label htmlFor="login-email">Email address</label>
              <div className="login-input">
                <Mail size={17} aria-hidden="true" />
                <Input id="login-email" required type="email" name="email" autoComplete="username" maxLength={254} placeholder="you@company.com" />
              </div>
            </div>
            <div className="task-field">
              <label htmlFor="login-password">Password</label>
              <div className="login-input">
                <LockKeyhole size={17} aria-hidden="true" />
                <PasswordInput id="login-password" required name="password" autoComplete="current-password" maxLength={256} placeholder="Enter your password" />
              </div>
            </div>
          </ActionForm>
        </section>
        <p className="login-help">Need access? Contact your workspace administrator.</p>
      </div>
    </main>
  );
}
