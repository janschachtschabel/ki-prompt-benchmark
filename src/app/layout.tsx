import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WLO Prompt Tester',
  description: 'Vergleiche Original- und optimierte KI-Prompts für edu-sharing Metadaten',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
