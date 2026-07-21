'use client';

import { billStyle, coinStyle } from '@/lib/moneyStyle';
import { formatDenom } from '@/lib/bills';

/**
 * Cara visual de un BILLETE de quetzal (solo apariencia, no interacción).
 * Rellena su contenedor (pasale un padre `relative` con tamaño).
 *
 *   variant="chip"  → billete completo con guilloche, texto y numerales (grande)
 *   variant="thumb" → miniatura: color + numeral (para listas compactas)
 */
export function BillFace({ denom, variant = 'chip', className = '' }) {
  const s = billStyle(denom);
  const thumb = variant === 'thumb';

  return (
    <div
      className={`overflow-hidden ${className}`}
      style={{
        background: `linear-gradient(135deg, ${s.c} 0%, ${s.a} 38%, ${s.b} 100%)`,
      }}
      aria-hidden="true"
    >
      {/* Guilloche: líneas finas entrelazadas tipo billete */}
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.35,
          backgroundImage: `repeating-radial-gradient(circle at 22% 50%, transparent 0 5px, ${s.ink}22 5px 6px), repeating-linear-gradient(115deg, transparent 0 7px, ${s.c}33 7px 8px)`,
        }}
      />
      {/* Roseta de seguridad */}
      <div
        className="absolute rounded-full"
        style={{
          right: thumb ? '-14%' : '8%',
          top: '50%',
          transform: 'translateY(-50%)',
          width: thumb ? '46%' : '30%',
          aspectRatio: '1 / 1',
          background: `radial-gradient(circle, ${s.c}cc 0%, ${s.a}00 62%)`,
          border: `1px solid ${s.c}66`,
        }}
      />

      {!thumb && (
        <>
          {/* Óvalo tipo retrato */}
          <div
            className="absolute rounded-[50%]"
            style={{
              left: '7%',
              top: '20%',
              width: '30%',
              height: '60%',
              background: `radial-gradient(ellipse at 45% 35%, ${s.c}aa 0%, ${s.b}cc 75%)`,
              border: `1px solid ${s.c}88`,
            }}
          />
          <p
            className="absolute font-black uppercase tracking-[0.14em]"
            style={{ left: '7%', top: '7%', fontSize: '7px', color: s.ink }}
          >
            Banco de Guatemala
          </p>
          <p
            className="absolute font-bold uppercase tracking-[0.2em]"
            style={{ left: '7%', bottom: '9%', fontSize: '7px', color: s.ink }}
          >
            {s.word} quetzales
          </p>
        </>
      )}

      {/* Numeral principal (esquina superior derecha) */}
      <p
        className="absolute font-black leading-none"
        style={{
          right: '7%',
          top: thumb ? '50%' : '12%',
          transform: thumb ? 'translateY(-50%)' : 'none',
          fontSize: thumb ? '20px' : '30px',
          color: '#ffffff',
          textShadow: `0 1px 0 ${s.b}, 0 0 8px ${s.b}66`,
        }}
      >
        {formatDenom(denom).replace('Q', '')}
      </p>
      {/* Numeral chico (esquina inferior izquierda) — solo chip */}
      {!thumb && (
        <p
          className="absolute font-black leading-none"
          style={{ right: '8%', bottom: '9%', fontSize: '13px', color: s.ink }}
        >
          Q{formatDenom(denom).replace('Q', '')}
        </p>
      )}
    </div>
  );
}

/**
 * Cara visual de una MONEDA de quetzal (metálica). Rellena un padre redondo.
 * Q1 es bimetálica (aro plata + centro dorado); el resto plata/níquel.
 */
export function CoinFace({ denom, className = '' }) {
  const s = coinStyle(denom);
  const silverRing =
    'radial-gradient(circle at 32% 28%, #ffffff 0%, #d4d8dd 20%, #a7adb5 55%, #7c828b 78%, #b6bcc4 100%)';
  const goldCenter =
    'radial-gradient(circle at 35% 30%, #fff2c4 0%, #e8c56a 40%, #b8892f 78%, #d9b45e 100%)';

  return (
    <div
      className={`relative rounded-full ${className}`}
      style={{
        background: silverRing,
        boxShadow:
          'inset 0 2px 4px rgba(255,255,255,0.7), inset 0 -3px 6px rgba(0,0,0,0.35), 0 4px 10px rgba(0,0,0,0.35)',
      }}
      aria-hidden="true"
    >
      {/* Estrías del canto */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            'repeating-conic-gradient(rgba(0,0,0,0.14) 0deg 3deg, transparent 3deg 6deg)',
          opacity: 0.5,
          maskImage: 'radial-gradient(circle, transparent 78%, #000 80%)',
          WebkitMaskImage: 'radial-gradient(circle, transparent 78%, #000 80%)',
        }}
      />
      {/* Disco interior (dorado en Q1) */}
      <div
        className="absolute rounded-full flex items-center justify-center"
        style={{
          inset: '18%',
          background: s.bimetal ? goldCenter : silverRing,
          boxShadow: 'inset 0 1px 3px rgba(255,255,255,0.6), inset 0 -2px 4px rgba(0,0,0,0.3)',
        }}
      >
        <span
          className="font-black leading-none"
          style={{
            fontSize: denom === 1 ? '18px' : '15px',
            color: s.bimetal ? '#6b4a12' : '#3f454d',
            textShadow: '0 1px 0 rgba(255,255,255,0.55)',
          }}
        >
          {s.label}
        </span>
      </div>
    </div>
  );
}
