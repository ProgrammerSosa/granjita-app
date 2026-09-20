import axios from 'axios';

function startKeepAlive() {
  const url = process.env.RENDER_EXTERNAL_URL;
  if (!url) {
    console.log('⚠️ RENDER_EXTERNAL_URL no disponible');
    return;
  }

  async function ping() {
    try {
      await axios.get(url);
      console.log(`✅ Keep-alive - ${new Date().toLocaleString()}`);
    } catch (error) {
      console.error(`❌ Error keep-alive: ${error.message}`);
    }
  }

  // Ejecutar cada 12 minutos
  ping(); // Primera ejecución
  setInterval(ping, 720000);
  
  console.log(`🚀 Keep-alive activo para ${url}`);
}

startKeepAlive();