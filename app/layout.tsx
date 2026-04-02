import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lumina: AI-Optimization Engine',
  description: 'Evaluate your website\'s AI-Readiness — how effectively its content can be parsed, understood, and indexed by Large Language Models and AI search engines.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#050a0f] text-slate-200 antialiased">
        {children}
      </body>
    </html>
  );
}
