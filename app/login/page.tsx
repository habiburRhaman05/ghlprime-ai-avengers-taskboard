import { redirect } from 'next/navigation';
import { ArrowUpRight, Check, Layers3, MessageSquareText, ShieldCheck, Sparkles } from 'lucide-react';
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
  return <main className="login-shell">
    <section className="login-story" aria-label="About the client portal">
      <div className="story-top"><span className="story-mark"><Layers3 size={18} /></span><span>GHL PRIME <span className="story-top-muted">/ CLIENT PORTAL</span></span></div>
      <div className="story-content">
        <p className="story-eyebrow"><Sparkles size={15} /> A BETTER WAY TO WORK TOGETHER</p>
        <h2>Good work starts<br /><span>in one place.</span></h2>
        <p className="story-description">Your projects, conversations, and next steps—together in one clear workspace.</p>
        <div className="story-preview" aria-hidden="true">
          <div className="preview-header"><div><span className="preview-kicker">YOUR WORKSPACE</span><strong>Everything in motion.</strong></div><span className="preview-icon"><ArrowUpRight size={17} /></span></div>
          <div className="preview-row"><span className="preview-dot preview-dot-blue" /><span>Keep projects organized</span><span className="preview-check"><Check size={14} /></span></div>
          <div className="preview-row"><span className="preview-dot preview-dot-violet" /><span>Follow the work in progress</span><span className="preview-pill">IN PROGRESS</span></div>
          <div className="preview-row"><span className="preview-dot preview-dot-green" /><span>Share updates with your team</span><MessageSquareText size={15} /></div>
        </div>
      </div>
      <div className="story-footer"><span>MADE FOR BETTER COLLABORATION</span><span>GHL PRIME © {new Date().getFullYear()}</span></div>
    </section>
    <section className="login-side">
      <div className="login-top"><Brand /><span>CLIENT PORTAL</span></div>
      <div className="login-content">
        <span className="login-icon"><ShieldCheck size={23} strokeWidth={1.7} /></span>
        <p className="login-eyebrow">YOUR WORKSPACE AWAITS</p>
        <h1>Welcome back<span>.</span></h1>
        <p className="login-subtitle">Sign in to pick up where you left off.</p>
        {link === 'expired' && <p role="alert" className="error">This account link is invalid or expired. Request a fresh link from your administrator.</p>}
        <ActionForm action={login} submit="Sign in to your workspace" className="stack login-form">
          <label>Email address<Input required type="email" name="email" autoComplete="email" maxLength={254} placeholder="you@company.com" /></label>
          <label>Password<PasswordInput required name="password" autoComplete="current-password" maxLength={256} placeholder="Enter your password" /></label>
        </ActionForm>
        <div className="login-help"><span className="login-help-icon"><ShieldCheck size={15} /></span><span>Need access? Contact your workspace administrator.</span></div>
      </div>
      <div className="login-bottom"><span>GHL Prime Client Portal</span><span>Built for better work.</span></div>
    </section>
  </main>;
}
