import type { Metadata } from 'next';
import { ServiceWorkerCleanup } from '../components/service-worker-cleanup';
import './globals.css';

export const metadata: Metadata = {
  title: 'FacilERP',
  description: 'Gestão corporativa de compras, orçamentos e patrimônio.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body><ServiceWorkerCleanup />{children}</body>
    </html>
  );
}
