import './globals.css';
import AppChrome from '@/components/AppChrome';

export const metadata = {
  title: 'La Granjita — Productos frescos a domicilio',
  description:
    'Productos frescos a domicilio en zonas residenciales de San José Pinula. Pedí online, pagá en efectivo o con terminal POS en casa.',
  keywords: [
    'La Granjita',
    'productos frescos',
    'delivery',
    'San José Pinula',
    'residenciales',
    'Guatemala',
    'pedidos online',
  ],
  openGraph: {
    title: 'La Granjita — Productos frescos a domicilio',
    description:
      'Entrega solo en residenciales de San José Pinula. Pedí online y pagá al recibir.',
    type: 'website',
    locale: 'es_GT',
  },
  robots: { index: true, follow: true },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#ea580c',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="font-sans">
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
