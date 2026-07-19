'use client';

import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';

const SECTIONS = [
  {
    title: 'Inicio y catálogo',
    icon: '🛒',
    body: 'Acá ves todos los productos de La Granjita, por categoría. Podés buscar por nombre y mirar los destacados. Tocá un producto para ver precio, variantes y extras.',
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
    body: 'Completás nombre, teléfono, residencial de San José Pinula y dirección. Elegís efectivo (indicando billetes para el vuelto) o tarjeta con terminal POS en tu casa. Al confirmar, te llega el aviso por WhatsApp.',
  },
  {
    title: 'Zona de entrega',
    icon: '📍',
    body: 'Solo entregamos en zonas residenciales de San José Pinula. Tenés que elegir tu residencial de la lista; fuera de esa zona no se puede pedir por la app.',
  },
  {
    title: 'Pagos',
    icon: '💵',
    body: 'No cobramos en línea. Pagás al recibir: en efectivo (con el vuelto calculado) o con tarjeta cuando llevamos el aparato POS a tu puerta.',
  },
  {
    title: 'WhatsApp',
    icon: '💬',
    body: 'Te avisamos del estado del pedido y te mandamos la factura. También podés escribirnos con el botón verde si necesitás ayuda.',
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
          usar la tienda.
        </p>
      </div>

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
