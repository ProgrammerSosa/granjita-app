'use client';

import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';

/** El viaje del pedido, como lo vive el cliente */
const FLOW = [
  {
    icon: '📝',
    title: 'Hacés tu pedido',
    body: 'Armás tu carrito, elegís tu residencial de San José Pinula y cómo pagás (efectivo o tarjeta con terminal en tu casa).',
  },
  {
    icon: '🆕',
    title: 'Lo recibimos',
    body: 'Te llega un WhatsApp: “recibimos tu pedido”. Un proveedor lo va a revisar enseguida.',
  },
  {
    icon: '✅',
    title: 'Lo confirmamos',
    body: 'Revisamos que tengamos todo lo que pediste. Si algo llegara a faltar, te avisamos por el chat y lo cambiamos por lo que vos quieras. Todavía podés agregar o quitar productos.',
  },
  {
    icon: '👨‍🍳',
    title: 'En proceso',
    body: 'Empezamos a prepararlo y te mandamos tu factura por WhatsApp. Desde acá el pedido ya queda cerrado.',
  },
  {
    icon: '🛵',
    title: 'En camino',
    body: 'Te avisamos que tu pedido salió a ruta. ¡Estate atento/a a la puerta!',
  },
  {
    icon: '🎉',
    title: 'Entregado',
    body: '¡Llegó tu pedido! Te mandamos un saludo y el link por si querés volver a pedir cuando quieras.',
  },
];

/** Menú del chat de WhatsApp */
const WA_MENU = [
  { n: '1', label: 'Hacer un pedido', desc: 'Te mandamos el link de la tienda.' },
  { n: '2', label: 'Atención al cliente', desc: 'Te atiende una persona del equipo por el chat.' },
  { n: '3', label: 'Modificar un pedido', desc: 'Pedís un cambio antes de que pase a “En proceso”.' },
];

const SECTIONS = [
  {
    title: 'Inicio y catálogo',
    icon: '🛒',
    body: 'Acá ves todos los productos de La Granjita, por categoría. Podés buscar por nombre y mirar los destacados. Tocá un producto para ver precio, variantes (por unidad o por peso) y extras.',
  },
  {
    title: 'Horario y estado',
    icon: '⏰',
    body: 'El banner te dice si estamos abiertos o cerrados. Trabajamos de lunes a sábado en dos turnos (10:30 am–3:00 pm y 4:00 pm–8:00 pm). Domingos cerrados salvo que habilitemos uno especial. Pedido mínimo Q 15.',
  },
  {
    title: 'Carrito',
    icon: '🧺',
    body: 'Sumá lo que quieras. Podés cambiar cantidades o vaciar el carrito. Si el total no llega al mínimo, o si estamos cerrados, no deja continuar al checkout.',
  },
  {
    title: 'Checkout / pedido',
    icon: '📝',
    body: 'Completás nombre, teléfono (tu WhatsApp real), residencial de San José Pinula y dirección. Elegís efectivo (indicando los billetes para calcular tu vuelto) o tarjeta con terminal POS en tu casa.',
  },
  {
    title: 'Zona de entrega',
    icon: '📍',
    body: 'Solo entregamos en zonas residenciales de San José Pinula. Elegí tu residencial de la lista; fuera de esa zona no se puede pedir por la app.',
  },
  {
    title: 'Pagos',
    icon: '💵',
    body: 'No cobramos en línea. Pagás al recibir: en efectivo (con el vuelto calculado según los billetes que indicaste) o con tarjeta cuando llevamos el aparato POS a tu puerta.',
  },
  {
    title: 'WhatsApp',
    icon: '💬',
    body: 'Te avisamos en cada paso del pedido y te mandamos tu factura. También podés escribirnos con el botón verde para pedir, cambiar algo o hablar con nosotros.',
  },
];

export default function AcercaDeClientePage() {
  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-10">
      <div className="text-center mb-8">
        <BrandLogo size={88} className="mx-auto mb-4" rounded="rounded-[1.5rem]" />
        <h1 className="text-2xl font-black text-ink-900">Acerca de La Granjita</h1>
        <p className="text-sm text-ink-500 mt-2 leading-relaxed max-w-sm mx-auto">
          Productos frescos a domicilio en residenciales de San José Pinula. Esta guía explica cómo
          usar la tienda y cómo avanza tu pedido.
        </p>
      </div>

      {/* CÓMO AVANZA TU PEDIDO */}
      <section className="card p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">🔄</span>
          <h2 className="font-black text-ink-900">¿Cómo avanza tu pedido?</h2>
        </div>
        <ol className="relative border-l-2 border-primary-100 ml-3 space-y-4">
          {FLOW.map((f, i) => (
            <li key={i} className="ml-6">
              <span className="absolute -left-[0.95rem] flex items-center justify-center w-8 h-8 rounded-full bg-primary-500 text-white text-sm ring-4 ring-white">
                {f.icon}
              </span>
              <h3 className="font-black text-ink-900 text-sm">{f.title}</h3>
              <p className="text-sm text-ink-600 mt-0.5 leading-relaxed">{f.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-ink-500 bg-primary-50 rounded-xl p-3 border border-primary-100">
          💡 Te avisamos de cada paso por WhatsApp, al mismo número con el que hacés el pedido.
        </p>
      </section>

      {/* MENÚ DE WHATSAPP */}
      <section className="card p-5 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">💬</span>
          <h2 className="font-black text-ink-900">Escribinos por WhatsApp</h2>
        </div>
        <p className="text-sm text-ink-500 mb-4">
          Cuando nos escribís, el chat te da un menú. Respondé con el número:
        </p>
        <div className="space-y-2">
          {WA_MENU.map((m) => (
            <div
              key={m.n}
              className="flex items-start gap-3 rounded-xl bg-ink-50 border border-ink-100 p-3"
            >
              <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-emerald-500 text-white font-black flex items-center justify-center text-sm">
                {m.n}
              </span>
              <div>
                <p className="font-bold text-ink-900 text-sm">{m.label}</p>
                <p className="text-xs text-ink-600 mt-0.5">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SECCIONES DE LA APP */}
      <div className="space-y-3">
        {SECTIONS.map((s) => (
          <article key={s.title} className="card p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0" aria-hidden="true">
                {s.icon}
              </span>
              <div>
                <h2 className="font-black text-ink-900 text-sm">{s.title}</h2>
                <p className="text-sm text-ink-600 mt-1 leading-relaxed">{s.body}</p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-8 card p-5 bg-gradient-to-br from-primary-50 to-white border-primary-100">
        <h2 className="font-black text-ink-900">¿Dudas?</h2>
        <p className="text-sm text-ink-600 mt-1">
          Escribinos por WhatsApp desde el botón verde o mirá el horario en la pantalla de inicio.
        </p>
        <Link href="/" className="btn-primary inline-flex mt-4 text-sm py-2.5 px-6">
          Volver al catálogo
        </Link>
      </div>
    </div>
  );
}
