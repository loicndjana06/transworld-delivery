import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TRANSWORLD DELIVERY',
  description: 'Plateforme de suivi et de gestion des dossiers de transport de fret maritime et terrestre.',
  openGraph: {
    title: 'TRANSWORLD DELIVERY',
    description: 'Plateforme de suivi et de gestion des dossiers de transport de fret maritime et terrestre.',
  },
  referrer: 'strict-origin-when-cross-origin',
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" dir="ltr">
      <body>{children}</body>
    </html>
  );
}
