import Link from 'next/link';

export function Brand() {
  return <Link className="brand-link" href="/" aria-label="AI Avengers™ home">
    <span className="brand-ai">AI</span> Avengers<sup>™</sup>
  </Link>;
}
