/**
 * Cloudinary — almacenamiento de imágenes PERMANENTE (no se borra en redeploys).
 * Variables de entorno (Render backend):
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 *
 * Si no está configurado, el sistema cae al disco local (efímero) como respaldo.
 */
const cloudinary = require('cloudinary').v2;

const CONFIGURED = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
);

if (CONFIGURED) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  console.log('[Cloudinary] Configurado — las imágenes se guardan permanentes.');
} else {
  console.log('[Cloudinary] Sin configurar — se usa disco local (efímero en Render).');
}

function isConfigured() {
  return CONFIGURED;
}

/**
 * Sube un buffer de imagen a Cloudinary. Redimensiona a máx 800px y optimiza
 * calidad/formato automáticamente (para no gastar ancho de banda de más).
 * @returns {Promise<{ secure_url: string, public_id: string }>}
 */
function uploadBuffer(buffer, folder = 'granjita') {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        transformation: [
          { width: 800, height: 800, crop: 'limit' },
          { quality: 'auto', fetch_format: 'auto' },
        ],
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
}

module.exports = { isConfigured, uploadBuffer, cloudinary };
