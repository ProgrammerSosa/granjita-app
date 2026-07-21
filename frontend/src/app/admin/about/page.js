'use client';

import BrandLogo from '@/components/BrandLogo';

/** Flujo de trabajo del pedido (lo que hace el sistema en cada estado) */
const FLOW = [
  {
    step: '1',
    icon: '🆕',
    title: 'Nuevo',
    tag: 'Editable',
    tagColor: 'bg-amber-100 text-amber-800',
    points: [
      'El cliente recibe por WhatsApp: “recibimos tu pedido, pronto un proveedor lo revisa”.',
      'Al dueño le llega el aviso “🚨 HAY PEDIDO NUEVO” con el detalle.',
      'Se genera el número de factura (todavía NO se envía).',
      'Podés modificar el pedido con “✏️ Modificar pedido”.',
    ],
  },
  {
    step: '2',
    icon: '✅',
    title: 'Confirmado',
    tag: 'Editable (última vez)',
    tagColor: 'bg-amber-100 text-amber-800',
    points: [
      'El cliente recibe: “un proveedor revisa si tenemos todo lo que pediste”.',
      'Acá va la ida y vuelta: si falta algo, se lo cambiás por lo que quiera.',
      'El cliente también puede pedir cambios por WhatsApp (opción 3 del menú).',
      'Aplicá los cambios con “✏️ Modificar pedido” (agregar / quitar / cantidades).',
    ],
  },
  {
    step: '3',
    icon: '👨‍🍳',
    title: 'En proceso',
    tag: '🔒 Se bloquea',
    tagColor: 'bg-red-100 text-red-700',
    points: [
      'El cliente recibe “manos a la obra” + la 🧾 FACTURA en texto.',
      'Desde acá el pedido YA NO se puede modificar.',
    ],
  },
  {
    step: '4',
    icon: '🛵',
    title: 'En camino',
    tag: 'A ruta',
    tagColor: 'bg-sky-100 text-sky-700',
    points: [
      'El cliente recibe: “tu pedido salió a ruta 🛵”.',
      'Al dueño/repartidor le llega la factura de entrega con billetes y vuelto a llevar.',
    ],
  },
  {
    step: '5',
    icon: '🎉',
    title: 'Entregado',
    tag: 'Cobrado',
    tagColor: 'bg-emerald-100 text-emerald-700',
    points: [
      'El cliente recibe: “entregado ✅ ¡que tengas un feliz día! ☀️”.',
      'Además le llega la invitación a pedir de nuevo con el link de la tienda.',
      'El pago se marca como cobrado.',
    ],
  },
];

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
    body: 'Inventario: reponé unidades, mirá agotados y stock bajo. Si llega a 0 se marca Agotado en la tienda. Al cancelar un pedido el stock vuelve solo. Alertas por WhatsApp y campana 🔔.',
  },
  {
    title: 'Categorías',
    icon: '🏷️',
    body: 'Organizá el menú (Frutas, Huevos, etc.). Podés crear, ocultar, reordenar o borrar categorías. El icono se muestra en la tienda.',
  },
  {
    title: 'Productos',
    icon: '🥕',
    body: 'Alta y edición de productos: precio, foto, variantes (unidad o por peso), extras, destacados y disponibilidad. Lo que marques “agotado” no se puede pedir.',
  },
  {
    title: 'Pedidos',
    icon: '🛵',
    body: 'Cola de pedidos en tiempo real. Cambiás el estado (Nuevo → Confirmado → En proceso → En camino → Entregado) y cada uno manda su WhatsApp al cliente. Con “✏️ Modificar pedido” agregás o quitás productos antes de En proceso. Registrás el cobro en efectivo con los billetes que el cliente declaró.',
  },
  {
    title: 'Facturas',
    icon: '🧾',
    body: 'Listado de facturas (TDA-año-número). Ves el PDF y podés reenviar la factura + PDF por WhatsApp al cliente con un botón.',
  },
  {
    title: 'Horario / Calendario',
    icon: '📅',
    body: 'Control total de cuándo se aceptan pedidos: turnos fijos, descansos planificados, habilitar un domingo especial, cierre de emergencia y pedido mínimo. Tocá un día para ver estadísticas de ese día.',
  },
  {
    title: 'WhatsApp',
    icon: '💬',
    body: 'En Admin → WhatsApp vinculás el número UNA sola vez (código de emparejamiento o QR). La sesión se guarda en el PC y al reiniciar el backend se reconecta solo. De ahí salen los avisos, las facturas y el menú automático.',
  },
  {
    title: 'Zona de entrega',
    icon: '📍',
    body: 'Solo residenciales de San José Pinula (Valle de las Hortensias, Cañadas de San José, etc.). El cliente elige de una lista; el sistema rechaza zonas fuera de la lista.',
  },
];

/** Menú automático de WhatsApp (switch por chat) */
const WA_MENU = [
  { n: '1', label: 'Hacer un pedido', desc: 'El bot manda el link de la tienda.' },
  { n: '2', label: 'Atención al cliente', desc: 'Avisa al dueño y le dice al cliente que en un momento lo atienden.' },
  { n: '3', label: 'Modificar un pedido', desc: 'El cliente escribe el cambio, le llega al dueño y se aplica antes de “En proceso”.' },
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
              Cómo funciona La Granjita por dentro: el flujo del pedido, cada apartado y el WhatsApp.
            </p>
          </div>
        </div>
      </div>

      {/* FLUJO DE TRABAJO */}
      <section className="card-admin p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">🔄</span>
          <h2 className="text-lg font-black text-admin-900">Flujo de trabajo del pedido</h2>
        </div>
        <p className="text-sm text-admin-500 mb-5">
          Cada vez que cambiás el estado de un pedido, el sistema manda el WhatsApp correcto al cliente.
        </p>

        <ol className="relative border-l-2 border-admin-200 ml-3 space-y-5">
          {FLOW.map((f) => (
            <li key={f.step} className="ml-6">
              <span className="absolute -left-[0.95rem] flex items-center justify-center w-8 h-8 rounded-full bg-ink-900 text-white text-sm font-black ring-4 ring-white">
                {f.icon}
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-admin-900">
                  {f.step}. {f.title}
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${f.tagColor}`}>
                  {f.tag}
                </span>
              </div>
              <ul className="mt-1.5 space-y-1">
                {f.points.map((p, i) => (
                  <li key={i} className="text-sm text-admin-600 leading-relaxed flex gap-2">
                    <span className="text-primary-400 mt-0.5">•</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>

        <div className="mt-5 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          <strong>❌ Cancelar:</strong> podés cancelar en cualquier momento antes de entregar. El
          stock de los productos vuelve solo al inventario.
        </div>
      </section>

      {/* MENÚ AUTOMÁTICO DE WHATSAPP */}
      <section className="card-admin p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">💬</span>
          <h2 className="text-lg font-black text-admin-900">Menú automático de WhatsApp</h2>
        </div>
        <p className="text-sm text-admin-500 mb-4">
          El <strong>primer mensaje de cada día</strong> del cliente dispara el saludo de bienvenida
          con estas 3 opciones. Después de un pedido, el bot ofrece un menú parecido donde con{' '}
          <strong>1</strong> puede hacer otro pedido.
        </p>
        <div className="space-y-2">
          {WA_MENU.map((m) => (
            <div
              key={m.n}
              className="flex items-start gap-3 rounded-xl bg-admin-50 border border-admin-100 p-3"
            >
              <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-emerald-500 text-white font-black flex items-center justify-center text-sm">
                {m.n}
              </span>
              <div>
                <p className="font-bold text-admin-900 text-sm">{m.label}</p>
                <p className="text-xs text-admin-600 mt-0.5">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* APARTADOS DEL PANEL */}
      <div>
        <h2 className="text-lg font-black text-admin-900 mb-3">Los apartados del panel</h2>
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
                  <h3 className="font-black text-admin-900 text-sm">{s.title}</h3>
                  <p className="text-sm text-admin-600 mt-1 leading-relaxed">{s.body}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="card-admin p-5 border-primary-200 bg-gradient-to-br from-primary-50 to-white">
        <h2 className="font-black text-admin-900">Tips para disfrutar el panel</h2>
        <ul className="mt-2 space-y-1.5 text-sm text-admin-600">
          <li>• Usá el calendario cuando sepas un feriado o viaje: un toque y listo.</li>
          <li>• Si un domingo querés abrir, tocá ese domingo → “Habilitar domingo”.</li>
          <li>• El cierre de emergencia pausa todo al instante sin borrar el calendario.</li>
          <li>• Modificá el pedido solo antes de “En proceso”: después se bloquea y sale la factura.</li>
          <li>• Mantené fotos claras en productos: venden más y se ven profesionales.</li>
        </ul>
      </div>
    </div>
  );
}
