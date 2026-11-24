import type { Metadata } from 'next';
import '@fontsource-variable/dm-sans';
import { Toaster } from 'sonner';
import './styles.css';
export const metadata: Metadata = {
  title: { default: 'AI Avengers™ | Client Portal', template: '%s | AI Avengers™' },
  description: 'Manage projects and collaborate with GHL Prime Team.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<Toaster position="top-right" richColors closeButton /></body></html>;
}
