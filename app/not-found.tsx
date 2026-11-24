import Link from 'next/link';
export default function NotFound() {
  return <main className="auth"><section className="card auth-card">
    <h1>Page unavailable</h1>
    <p>This page may have moved or require project access.</p>
    <Link className="button" href="/dashboard">Back to dashboard</Link>
  </section></main>;
}
