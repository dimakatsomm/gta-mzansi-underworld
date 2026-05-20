import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { PLACES } from '@gtarp/sa-content';
import './globals.css';

export const metadata: Metadata = {
  title: `${PLACES.MZANSI} Underworld RP`,
  description: `AI-powered South African criminal society simulator. ${PLACES.EGOLI} never sleeps.`,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
