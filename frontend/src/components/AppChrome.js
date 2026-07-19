'use client';

import { usePathname } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import WhatsAppButton from '@/components/WhatsAppButton';
import CartBar from '@/components/CartBar';
import ToastProvider from '@/components/ToastProvider';
import ClosedWelcome from '@/components/ClosedWelcome';

export default function AppChrome({ children }) {
  const pathname = usePathname() || '';
  const isAdmin = pathname.startsWith('/admin');

  return (
    <>
      {!isAdmin && <Navbar />}
      <main className={isAdmin ? 'min-h-screen' : 'pt-16 pb-28 min-h-screen'}>
        {children}
      </main>
      {!isAdmin && (
        <>
          <Footer />
          <WhatsAppButton />
          <CartBar />
          <ClosedWelcome />
        </>
      )}
      <ToastProvider />
    </>
  );
}
