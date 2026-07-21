/**
 * Zonas de entrega: solo residenciales de San José Pinula (Guatemala).
 * El cliente debe elegir una de esta lista al pedir.
 */
const DELIVERY_MUNICIPALITY = 'San José Pinula';

const RESIDENTIAL_ZONES = [
  'Valle de las Hortensias',
  'Cañadas de San José',
  'Hortensias Premium',
  'Hortensias Normal',
  'San José de las Fuentes 1',
  'San José de las Fuentes 2',
  'Azucenas',
  'Valle de los Almendros',
  'Orquídeas',
  'Valle de los Sauces',
  'Azahares',
  'Ángeles',
  'Geranios 1',
  'Geranios 2',
  'Violetas 1',
  'Violetas 2',
  'Villas del Campanario',
  'Las Rosas',
  'Los Tulipanes',
  'Claveles',
  'Girasoles 1',
  'Girasoles 2',
  'Margaritas',
  'Azaleas',
  'Santa Cruz del Valle',
  'Los Pinos',
  'Distrito Olivares',
];

function normalizeZoneName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isAllowedZone(zoneName) {
  if (!zoneName) return false;
  const n = normalizeZoneName(zoneName);
  return RESIDENTIAL_ZONES.some((z) => normalizeZoneName(z) === n);
}

function findZone(zoneName) {
  if (!zoneName) return null;
  const n = normalizeZoneName(zoneName);
  return RESIDENTIAL_ZONES.find((z) => normalizeZoneName(z) === n) || null;
}

function getDeliveryZonesPayload() {
  return {
    municipality: DELIVERY_MUNICIPALITY,
    onlyResidential: true,
    zones: RESIDENTIAL_ZONES,
    note: 'Solo entregamos en zonas residenciales de San José Pinula.',
  };
}

module.exports = {
  DELIVERY_MUNICIPALITY,
  RESIDENTIAL_ZONES,
  isAllowedZone,
  findZone,
  getDeliveryZonesPayload,
  normalizeZoneName,
};
