/**
 * Estilos visuales del quetzal (GTQ) — colores reales por denominación.
 * Solo apariencia; la lógica de montos vive en bills.js.
 */

/** Billetes: a=color base, b=sombra profunda, c=brillo, ink=texto oscuro legible */
export const BILL_STYLES = {
  200: { word: 'Doscientos', a: '#14a394', b: '#0a5d54', c: '#63d8ca', ink: '#04352f' },
  100: { word: 'Cien', a: '#9a6a34', b: '#573717', c: '#cd9457', ink: '#38230f' },
  50: { word: 'Cincuenta', a: '#ec8a1e', b: '#a1500a', c: '#f7b658', ink: '#5a2f05' },
  20: { word: 'Veinte', a: '#2670b4', b: '#123f6e', c: '#5c9cdb', ink: '#0b2b4e' },
  10: { word: 'Diez', a: '#c2433f', b: '#7c2222', c: '#e37b73', ink: '#481313' },
  5: { word: 'Cinco', a: '#cc5286', b: '#872d54', c: '#ea89b1', ink: '#4f1931' },
  1: { word: 'Uno', a: '#1f9d6b', b: '#0f5c40', c: '#5fcb9c', ink: '#093a27' },
};

/** Monedas: Q1 es bimetálica (aro plateado + centro dorado), el resto plata/níquel */
export const COIN_STYLES = {
  1: { label: 'Q1', bimetal: true },
  0.5: { label: '50¢', bimetal: false },
  0.25: { label: '25¢', bimetal: false },
};

export function billStyle(denom) {
  return BILL_STYLES[denom] || BILL_STYLES[20];
}

export function coinStyle(denom) {
  return COIN_STYLES[denom] || { label: `Q${denom}`, bimetal: false };
}
