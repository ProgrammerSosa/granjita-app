'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchWhatsAppAdminStatus,
  fetchWhatsAppQr,
  requestWhatsAppPairingCode,
  logoutWhatsApp,
  testWhatsAppAdmin,
} from '@/lib/api';
import useToastStore from '@/store/useToastStore';
import BrandLogo from '@/components/BrandLogo';

export default function AdminWhatsAppPage() {
  const [status, setStatus] = useState(null);
  const [qrImage, setQrImage] = useState(null);
  const [phone, setPhone] = useState('');
  const [pairing, setPairing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const toast = useToastStore((s) => s.success);
  const toastError = useToastStore((s) => s.error);
  const askConfirm = useToastStore((s) => s.askConfirm);

  const load = useCallback(async () => {
    try {
      const st = await fetchWhatsAppAdminStatus();
      setStatus(st);
      if (!st.connected) {
        try {
          const qr = await fetchWhatsAppQr();
          setQrImage(qr.qrImage || null);
        } catch {
          setQrImage(null);
        }
      } else {
        setQrImage(null);
        setPairing(null);
      }
      if (st.pairingCode) {
        setPairing({ code: st.pairingCode, phone: st.pairingPhone });
      }
    } catch (err) {
      toastError(err.message || 'Error al cargar estado WA');
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  async function handlePairing(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await requestWhatsAppPairingCode(phone || undefined);
      setPairing(res.data);
      toast('Código listo — escribilo en el celular');
      await load();
    } catch (err) {
      toastError(err.message || 'No se pudo generar el código');
    } finally {
      setBusy(false);
    }
  }

  async function handleTest() {
    setBusy(true);
    try {
      const res = await testWhatsAppAdmin();
      toast(res.message || 'Mensaje de prueba enviado');
    } catch (err) {
      toastError(err.message || 'Error al enviar prueba');
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout(deleteSession) {
    const ok = await askConfirm({
      title: deleteSession ? 'Desvincular y borrar sesión' : 'Desvincular WhatsApp',
      message: deleteSession
        ? 'Se borra la sesión del PC. La próxima vez tendrás que enlazar de nuevo (una sola vez).'
        : 'Se cierra la conexión actual. Puede pedir QR al reiniciar.',
      confirmLabel: deleteSession ? 'Borrar y desvincular' : 'Desvincular',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await logoutWhatsApp(deleteSession);
      setPairing(null);
      toast(deleteSession ? 'Sesión borrada' : 'Desvinculado');
      await load();
    } catch (err) {
      toastError(err.message || 'Error');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const connected = status?.connected;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink-950 via-ink-900 to-emerald-900 text-white p-6 sm:p-8 shadow-lift">
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl" />
        <div className="relative flex items-start gap-4">
          <BrandLogo size={64} rounded="rounded-2xl" ring={false} className="ring-2 ring-white/20" />
          <div>
            <p className="text-emerald-300 text-xs font-bold uppercase tracking-widest">
              WhatsApp del negocio
            </p>
            <h1 className="text-2xl font-black tracking-tight mt-0.5">Enlazar una sola vez</h1>
            <p className="text-sm text-white/75 mt-2 max-w-lg leading-relaxed">
              {status?.oneTimeLink ||
                'Vinculás el WhatsApp una vez. Después, cada vez que prendés el backend se reconecta solo, sin QR.'}
            </p>
          </div>
        </div>
      </div>

      {/* Estado */}
      <div
        className={`card-admin p-5 border-2 ${
          connected
            ? 'border-emerald-300 bg-emerald-50/50'
            : status?.sessionSaved
              ? 'border-sky-300 bg-sky-50/40'
              : 'border-amber-300 bg-amber-50/40'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-admin-500">Estado</p>
            <p className="text-xl font-black text-admin-900 mt-0.5">
              {connected
                ? '🟢 Conectado — listo para pedidos'
                : status?.sessionSaved
                  ? '🔵 Sesión guardada — reconectando…'
                  : '🟡 Sin vincular — enlazá abajo (solo una vez)'}
            </p>
            {status?.lastEvent && (
              <p className="text-xs text-admin-500 mt-1 font-mono">{status.lastEvent}</p>
            )}
          </div>
          {connected && (
            <button
              type="button"
              disabled={busy}
              onClick={handleTest}
              className="btn-admin text-sm"
            >
              Enviar mensaje de prueba
            </button>
          )}
        </div>

        <div className="mt-4 grid sm:grid-cols-2 gap-2 text-xs font-semibold text-admin-600">
          <div className="rounded-xl bg-white border border-admin-200 px-3 py-2">
            Sesión en disco:{' '}
            <span className={status?.sessionSaved ? 'text-emerald-700' : 'text-amber-700'}>
              {status?.sessionSaved ? 'Sí (no pide QR al reiniciar)' : 'No todavía'}
            </span>
          </div>
          <div className="rounded-xl bg-white border border-admin-200 px-3 py-2 truncate" title={status?.authPath}>
            Carpeta: {status?.authPath || '—'}
          </div>
        </div>
      </div>

      {!connected && (
        <>
          {/* Opción preferida: código sin cámara */}
          <div className="card-admin p-5 space-y-4">
            <div>
              <h2 className="font-black text-admin-900 text-lg">Opción 1 · Código (sin QR)</h2>
              <p className="text-sm text-admin-500 mt-1 leading-relaxed">
                En el celular: <strong>WhatsApp → Dispositivos vinculados → Vincular un dispositivo
                → Vincular con número de teléfono</strong> y escribí el código de 8 dígitos.
              </p>
            </div>

            <form onSubmit={handlePairing} className="flex flex-col sm:flex-row gap-2">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="50259965916 (código país + número)"
                className="input-admin flex-1"
                disabled={busy}
              />
              <button type="submit" disabled={busy} className="btn-admin whitespace-nowrap">
                Generar código
              </button>
            </form>
            <p className="text-[11px] text-admin-400">
              Si dejás el número vacío usa OWNER_WHATSAPP del .env del backend.
            </p>

            {pairing?.code && (
              <div className="rounded-2xl bg-ink-950 text-white p-6 text-center">
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-2">
                  Código para el celular
                </p>
                <p className="text-4xl font-black tracking-[0.25em] text-white font-mono">
                  {String(pairing.code).replace(/(\d{4})(\d{4})/, '$1 $2')}
                </p>
                {pairing.phone && (
                  <p className="text-sm text-white/60 mt-2">Número: {pairing.phone}</p>
                )}
                <p className="text-xs text-white/50 mt-3">
                  El código dura poco. Si expira, generá otro.
                </p>
              </div>
            )}
          </div>

          {/* QR de respaldo */}
          <div className="card-admin p-5 space-y-3">
            <h2 className="font-black text-admin-900 text-lg">Opción 2 · QR clásico</h2>
            <p className="text-sm text-admin-500">
              WhatsApp → Dispositivos vinculados → Vincular un dispositivo → escanear este código.
            </p>
            {qrImage ? (
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-2xl border border-admin-200 shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrImage} alt="QR WhatsApp" width={260} height={260} className="block" />
                </div>
              </div>
            ) : (
              <p className="text-sm text-admin-500 text-center py-6">
                {status?.sessionSaved
                  ? 'No hay QR: está intentando usar la sesión guardada. Esperá o mirá la consola del backend.'
                  : 'Esperando QR… (reiniciá el backend si tarda mucho)'}
              </p>
            )}
          </div>
        </>
      )}

      {/* Cómo funciona */}
      <div className="card-admin p-5 space-y-2">
        <h2 className="font-black text-admin-900">¿Cada vez que prendo el proyecto?</h2>
        <ul className="text-sm text-admin-600 space-y-2 leading-relaxed">
          <li>
            <strong className="text-admin-900">No.</strong> Solo vinculás{' '}
            <strong>una vez</strong> (código o QR).
          </li>
          <li>
            La sesión se guarda en tu PC (
            <code className="text-xs bg-admin-100 px-1 rounded">.tienda-wwebjs-auth</code>
            ). Al abrir el backend, WhatsApp entra solo.
          </li>
          <li>
            Solo vuelve a pedir QR/código si: desvinculás el dispositivo en el celular, borrás la
            carpeta de sesión, o usás “Borrar sesión” acá.
          </li>
          <li>
            Dejá el <strong>backend corriendo</strong> mientras querés recibir pedidos por WA.
          </li>
        </ul>
      </div>

      {connected && (
        <div className="card-admin p-5 space-y-3">
          <h2 className="font-black text-admin-900">Desvincular</h2>
          <p className="text-sm text-admin-500">
            Solo si cambiás de número o hay problemas. En condiciones normales no hace falta.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => handleLogout(false)}
              className="btn-outline text-sm py-2.5"
            >
              Desvincular
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => handleLogout(true)}
              className="btn-danger text-sm py-2.5"
            >
              Desvincular y borrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
