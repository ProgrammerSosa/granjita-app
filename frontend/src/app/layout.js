import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata = {
  title: 'GRANJITA - Productos Frescos',
  description: 'Hacé tu pedido de productos frescos online y recibilo en casa.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#ea580c',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <Navbar />
        <main className="pt-16 pb-8 min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
