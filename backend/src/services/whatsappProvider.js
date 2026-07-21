/**
 * INTERRUPTOR de motor de WhatsApp.
 *
 *   WHATSAPP_PROVIDER = web    → motor actual (whatsapp-web.js)  ← POR DEFECTO
 *   WHATSAPP_PROVIDER = cloud  → motor nuevo (WhatsApp Cloud API de Meta)
 *
 * Si el motor nuevo diera problema, se vuelve al viejo poniendo la variable en
 * "web" (o borrándola). Nada se pierde: el motor viejo queda intacto.
 */
const provider = String(process.env.WHATSAPP_PROVIDER || 'web').toLowerCase();

let impl;
if (provider === 'cloud') {
  console.log('[WhatsApp] Motor: Cloud API (Meta)');
  impl = require('./whatsappCloudService');
} else {
  console.log('[WhatsApp] Motor: whatsapp-web.js (por defecto)');
  impl = require('./whatsappService');
}

module.exports = impl;
