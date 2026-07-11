const mongoose = require('mongoose');
const fs = require('fs');

const sessionSchema = new mongoose.Schema({
  _id: { type: String, default: 'whatsapp_session' },
  data: Buffer,
  updatedAt: { type: Date, default: Date.now },
});

const Session = mongoose.model('Session', sessionSchema);

const store = {
  async sessionExists({ session }) {
    const doc = await Session.findById(session);
    const exists = !!(doc && doc.data && doc.data.length > 0);
    console.log(`[RemoteAuth] sessionExists("${session}"): ${exists}`);
    return exists;
  },

  async save({ session }) {
    const zipPath = `${session}.zip`;
    if (!fs.existsSync(zipPath)) {
      console.warn(`[RemoteAuth] Archivo zip no encontrado: ${zipPath}`);
      return;
    }
    const data = fs.readFileSync(zipPath);
    await Session.findOneAndUpdate(
      { _id: session },
      { data, updatedAt: new Date() },
      { upsert: true }
    );
    console.log(`[RemoteAuth] Sesión "${session}" guardada en MongoDB (${data.length} bytes)`);
  },

  async extract({ session, path: zipPath }) {
    const doc = await Session.findById(session);
    if (!doc || !doc.data) {
      console.warn(`[RemoteAuth] No hay datos para extraer: "${session}"`);
      return;
    }
    fs.writeFileSync(zipPath, doc.data);
    console.log(`[RemoteAuth] Sesión "${session}" extraída a ${zipPath} (${doc.data.length} bytes)`);
  },

  async delete({ session }) {
    await Session.findByIdAndDelete(session);
    console.log(`[RemoteAuth] Sesión "${session}" eliminada de MongoDB`);
  },
};

module.exports = store;
