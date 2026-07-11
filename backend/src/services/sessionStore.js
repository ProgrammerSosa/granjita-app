const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  _id: { type: String, default: 'whatsapp_session' },
  data: Buffer,
  updatedAt: { type: Date, default: Date.now },
});

const Session = mongoose.model('Session', sessionSchema);

const store = {
  async save(session) {
    await Session.findOneAndUpdate(
      { _id: 'whatsapp_session' },
      { data: session.data, updatedAt: new Date() },
      { upsert: true }
    );
    console.log('[RemoteAuth] Sesión guardada en MongoDB');
  },

  async get() {
    const doc = await Session.findById('whatsapp_session');
    if (doc && doc.data) {
      console.log('[RemoteAuth] Sesión restaurada desde MongoDB');
      return { data: doc.data };
    }
    console.log('[RemoteAuth] No hay sesión guardada en MongoDB');
    return null;
  },

  async delete() {
    await Session.findByIdAndDelete('whatsapp_session');
    console.log('[RemoteAuth] Sesión eliminada de MongoDB');
  },
};

module.exports = store;
