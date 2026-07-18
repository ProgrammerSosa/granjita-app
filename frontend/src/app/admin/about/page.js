'use client';

import BrandLogo from '@/components/BrandLogo';

const SECTIONS = [
  {
    title: 'Inicio',
    icon: '🏠',
    body: 'Resumen rápido del día y accesos a Estadísticas, Stock, Pedidos y WhatsApp.',
  },
  {
    title: 'Estadísticas',
    icon: '📊',
    body: 'Gráficos de ventas por hora, últimos 7 días, pagos, estados y top productos. Elegí la fecha.',
  },
  {
    title: 'Stock',
    icon: '📦',
    body: 'Inventario: reponé unidades, mirá agotados y stock bajo. Si llega a 0 se marca Agotado en la tienda. Alertas por WhatsApp y campana 🔔.',
  },
  {
    title: 'Categorías',
    icon: '🏷️',
    body: 'Organizá el menú (Frutas, Huevos, etc.). Podés crear, ocultar, reordenar o borrar categorías. El icono se muestra en la tienda.',
  },
  {
    title: 'Productos',
    icon: '🥕',
    body: 'Alta y edición de productos: precio, foto, variantes, extras, destacados y si está disponible. Lo que marques “agotado” no se puede pedir.',
  },
  {
    title: 'Pedidos',
    icon: '🛵',
    body: 'Cola de pedidos en tiempo real. Cambiá estados (confirmado → preparando → en camino → entregado). Al pasar a “en camino” se maneja la factura y el WhatsApp. Registrá el cobro en efectivo.',
  },
  {
    title: 'Facturas',
    icon: '🧾',
    body: 'Listado de facturas generadas (TDA-año-número). Podés ver o reenviar PDF según lo configurado en el backend.',
  },
  {
    title: 'Horario / Calendario',
    icon: '📅',
    body: 'Control total de cuándo se aceptan pedidos: turnos fijos, descansos planificados, habilitar un domingo especial, cierre de emergencia y pedido mínimo. Tocá un día para ver estadísticas de ese día.',
  },
  {
    title: 'WhatsApp',
    icon: '💬',
    body: 'En Admin → WhatsApp vinculás el número UNA sola vez (código de emparejamiento o QR). La sesión se guarda en el PC y al reiniciar el backend se reconecta solo. Confirmaciones, facturas y menús salen de ahí.',
  },
  {
    title: 'Zona de entrega',
    icon: '📍',
    body: 'Solo residenciales de San José Pinula. El cliente elige de una lista; el sistema rechaza zonas fuera de la lista.',
  },
];

export default function AdminAboutPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink-900 via-ink-800 to-primary-800 text-white p-6 sm:p-8 shadow-lift">
        <div className="absolute -right-8 -top-8 w-40 h-40 bg-primary-500/30 rounded-full blur-3xl" />
        <div className="relative flex items-center gap-4">
          <BrandLogo size={72} rounded="rounded-2xl" ring={false} className="ring-2 ring-white/30" />
          <div>
            <p className="text-primary-300 text-xs font-bold uppercase tracking-widest">
              Manual del panel
            </p>
            <h1 className="text-2xl font-black tracking-tight">Acerca del admin</h1>
            <p className="text-sm text-white/75 mt-1 max-w-md">
              Guía rápida de cada apartado para que te sientas cómodo manejando La Granjita.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <article
            key={s.title}
            className="card-admin p-4 hover:shadow-md hover:border-primary-200 transition-all"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl" aria-hidden="true">
                {s.icon}
              </span>
              <div>
                <h2 className="font-black text-admin-900 text-sm">{s.title}</h2>
                <p className="text-sm text-admin-600 mt-1 leading-relaxed">{s.body}</p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="card-admin p-5 border-primary-200 bg-gradient-to-br from-primary-50 to-white">
        <h2 className="font-black text-admin-900">Tips para disfrutar el panel</h2>
        <ul className="mt-2 space-y-1.5 text-sm text-admin-600">
          <li>• Usá el calendario cuando sepas un feriado o viaje: un toque y listo.</li>
          <li>• Si un domingo querés abrir, tocá ese domingo → “Habilitar domingo”.</li>
          <li>• El cierre de emergencia pausa todo al instante sin borrar el calendario.</li>
          <li>• Mantené fotos claras en productos: venden más y se ven profesionales.</li>
        </ul>
      </div>
    </div>
  );
}
