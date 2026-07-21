/**
 * RESET DE DATOS — deja el programa limpio para entregar al product owner.
 *
 * BORRA (permanente, no se puede deshacer):
 *   • Pedidos            (colección Order)
 *   • Productos          (colección Product)
 *   • Categorías         (colección Category)
 *   • Facturas PDF       (data/invoices/*.pdf)
 *   • Alertas de stock   (data/stock-alerts.json → vacío)
 *   • Sesiones de menú WA (data/wa-sessions.json → vacío)
 *
 * MANTIENE:
 *   • Login de admin (ADMIN_PASSWORD en .env)
 *   • Horarios de la tienda (data/store-settings.json)
 *   • Vinculación de WhatsApp (sesión LocalAuth fuera del proyecto)
 *
 * USO (desde la carpeta backend):
 *   node scripts/reset-data.js --yes
 * Sin --yes, no borra nada (solo muestra qué haría).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const CONFIRMED = process.argv.includes('--yes');
const DATA_DIR = path.join(__dirname, '..', 'data');
const INVOICES_DIR = path.join(DATA_DIR, 'invoices');

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ Falta MONGODB_URI en el .env del backend.');
    process.exit(1);
  }

  if (!CONFIRMED) {
    console.log('⚠️  MODO PRUEBA (no se borró nada).');
    console.log('   Esto BORRARÍA de forma permanente:');
    console.log('     • Todos los pedidos');
    console.log('     • Todos los productos');
    console.log('     • Todas las categorías');
    console.log('     • Las facturas PDF');
    console.log('     • Las alertas de stock y las sesiones de menú de WhatsApp');
    console.log('   Se MANTIENE: login admin, horarios y la vinculación de WhatsApp.');
    console.log('');
    console.log('   Para ejecutar de verdad, corré:  node scripts/reset-data.js --yes');
    process.exit(0);
  }

  console.log('🧹 Conectando a la base de datos…');
  await mongoose.connect(process.env.MONGODB_URI);

  const Order = require('../src/models/Order');
  const Product = require('../src/models/Product');
  const Category = require('../src/models/Category');

  const [ordersN, productsN, categoriesN] = await Promise.all([
    Order.countDocuments(),
    Product.countDocuments(),
    Category.countDocuments(),
  ]);

  await Order.deleteMany({});
  await Product.deleteMany({});
  await Category.deleteMany({});
  console.log(`🗑️  Borrados: ${ordersN} pedidos, ${productsN} productos, ${categoriesN} categorías.`);

  // Facturas PDF
  let pdfN = 0;
  try {
    if (fs.existsSync(INVOICES_DIR)) {
      for (const f of fs.readdirSync(INVOICES_DIR)) {
        if (f.toLowerCase().endsWith('.pdf')) {
          fs.unlinkSync(path.join(INVOICES_DIR, f));
          pdfN += 1;
        }
      }
    }
  } catch (e) {
    console.warn('⚠️  No se pudieron borrar todas las facturas PDF:', e.message);
  }
  console.log(`🗑️  Borradas: ${pdfN} facturas PDF.`);

  // Alertas de stock → estado vacío
  try {
    fs.writeFileSync(
      path.join(DATA_DIR, 'stock-alerts.json'),
      JSON.stringify({ last: {}, events: [] }, null, 2),
      'utf8'
    );
  } catch (e) {
    console.warn('⚠️  stock-alerts.json:', e.message);
  }

  // Sesiones de menú de WhatsApp → vacío
  try {
    fs.writeFileSync(path.join(DATA_DIR, 'wa-sessions.json'), '{}', 'utf8');
  } catch (e) {
    console.warn('⚠️  wa-sessions.json:', e.message);
  }
  console.log('🗑️  Reseteadas: alertas de stock y sesiones de menú de WhatsApp.');

  await mongoose.disconnect();
  console.log('');
  console.log('✅ Listo. El programa quedó limpio (admin, horarios y WhatsApp intactos).');
  console.log('   El product owner ya puede cargar su catálogo desde Admin → Productos.');
}

main().catch(async (err) => {
  console.error('❌ Error en el reset:', err.message);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
