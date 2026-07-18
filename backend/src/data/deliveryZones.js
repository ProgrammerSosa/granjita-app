/**
 * Zonas de entrega: solo residenciales de San José Pinula (Guatemala).
 * El cliente debe elegir una de esta lista al pedir.
 */
const DELIVERY_MUNICIPALITY = 'San José Pinula';

const RESIDENTIAL_ZONES = [
  'Residenciales Altos de San José',
  'Residenciales Altos de la Laguna',
  'Residenciales Bosques de San José',
  'Residenciales Cascadas de San José',
  'Residenciales Cumbres de San José',
  'Residenciales El Encinal',
  'Residenciales Hacienda Real',
  'Residenciales Lomas de San José',
  'Residenciales Monte Bello',
  'Residenciales Pinares del Norte',
  'Residenciales Portal del Valle',
  'Residenciales Puerta Paraíso',
  'Residenciales San José',
  'Residenciales Santa Rosalía',
  'Residenciales Valle de las Luces',
  'Residenciales Valle Dorado',
  'Residenciales Villas de San José',
  'Residenciales Vista Hermosa (SJP)',
  'Colonia El Manantial',
  'Colonia San José Pinula Centro residencial',
  'Km 16–18 Carretera a San José Pinula (residencial)',
  'Km 18–20 Carretera a San José Pinula (residencial)',
  'Km 20–22 Carretera a San José Pinula (residencial)',
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
