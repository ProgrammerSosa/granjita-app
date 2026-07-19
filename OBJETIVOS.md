# Objetivos del Proyecto - Granjita

## Descripcion General
Tienda en linea de productos alimenticios con venta por unidad (piezas) y por peso (libras),
panel de administracion y sistema de pedidos.

---

## Objetivos Completados

### Backend (Express + MongoDB)
- [x] Servidor Express con conexion a MongoDB
- [x] Modelo de Producto con campo `sellBy` (unit / weight / both)
- [x] Modelo de Pedido con estados (pendiente, en proceso, entregado)
- [x] Rutas y controladores para CRUD de productos
- [x] Rutas y controladores para gestion de pedidos
- [x] Subida de imagenes al servidor (max 5MB, formatos JPG/PNG/WebP/GIF)
- [x] Autenticacion por clave de administrador
- [x] Correccion del bug `cash_on_delivery` en paymentStatus
- [x] Endpoint para editar items de un pedido existente (PATCH /orders/:id/items)
- [x] Endpoint para reenviar factura por WhatsApp (POST /orders/:id/send-whatsapp)
- [x] Chatbot de WhatsApp con menu interactivo (opcion 1: ordenar, opcion 2: atencion)
- [x] Notificacion al owner cuando un cliente necesita atencion
- [x] Funcion para enviar factura al cliente por WhatsApp

### Frontend (Next.js 14 + Tailwind CSS)
- [x] Pagina principal con catalogo de productos
- [x] Filtro de productos por categoria
- [x] Carrito de compras con variantes (unidades y peso)
- [x] Formulario de checkout con datos del cliente
- [x] Logo de marca en navbar, pagina de inicio y panel admin

### Panel de Administracion
- [x] Login con contrasena (emadiana12345)
- [x] Gestion de productos: crear, editar, eliminar
- [x] Gestion de pedidos con cambio de estados
- [x] Checkboxs independientes para tipo de venta (unidad / peso)
- [x] Zona de arrastrar y soltar para subir imagenes con preview
- [x] Spinner de carga durante subida de imagen
- [x] Preview grande de imagen con opcion de quitar (hover)
- [x] Edicion de items de un pedido (cantidad, precio, agregar, quitar)
- [x] Reenvio de factura por WhatsApp desde el panel admin
- [x] Vista de productos agotados en pedidos pendientes

### UI / UX
- [x] Interfaz sin emojis, usando iconos SVG personalizados
- [x] Modal de confirmacion antes de eliminar (ConfirmModal)
- [x] Modal de alerta para pedidos (AlertModal) - sin usar confirm() ni alert()
- [x] Toggle switch para elegir unidad/peso en vista del cliente
- [x] Acceso secreto al admin: 10 toques en el logo en 1.5 segundos
- [x] Link del admin visible por 8 segundos despues del gesto secreto
- [x] Mensajes de WhatsApp sin emojis, con formato limpio

### Integracion WhatsApp
- [x] Conexion con WhatsApp Web via whatsapp-web.js
- [x] Chatbot con menu interactivo (opcion 1: ordenar, opcion 2: atencion al cliente)
- [x] Notificacion al owner cuando llega un nuevo pedido
- [x] Notificacion al owner cuando un cliente necesita atencion
- [x] Envio de factura al cliente por WhatsApp
- [x] Reenvio de factura actualizada desde el panel admin
- [x] Dos menus diferentes: Menu1 (primera interaccion) y Menu2 (despues de compra)
- [x] Opcion 4: cambios al pedido con busqueda por ID
- [x] Cambio automatico de menu despues de cada compra
- [x] Notificacion "Pedido en camino" al cliente
- [x] Boton "Pedido en camino" en el panel admin

---

## Objetivos Pendientes

- [ ] Pagina de detalle de producto
- [ ] Sistema de busqueda de productos
- [ ] Paginacion del catalogo
- [ ] Notificaciones por correo al recibir un pedido
- [ ] Edicion masiva de productos (seleccion multiples)
- [ ] Historial de pedidos por cliente
- [ ] Cupones o descuentos
- [ ] Modo oscuro
- [ ] Pago con tarjeta (MercadoPago) - pendiente de implementar

---

## Tecnologias Utilizadas
- **Backend**: Node.js, Express, MongoDB, Mongoose
- **Frontend**: Next.js 14, React, Tailwind CSS
- **Paqueteria**: pnpm
- **Despliegue**: Render (render.yaml)
























const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const Order = require('../models/Order');

let client = null;
let isReady = false;
let reconnectAttempts = 0;
let currentQR = null;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 10000;

const AUTO_REPLY_ENABLED = process.env.WHATSAPP_AUTO_REPLY === 'true';
const STORE_URL = process.env.STORE_URL || 'https://granjita-frontend.onrender.com/';
const BACKEND_URL = process.env.BACKEND_URL || 'https://granjita-app.onrender.com';
const OWNER_NUMBER = process.env.OWNER_WHATSAPP || '';

const customerStates = new Map();
let accessInfoSent = false;

function getMenu1(customerName) {
  return (
    `Hola! Bienvenido a GRANJITA\n\n` +
    `Mande *1* si quiere ordenar\n` +
    `Mande *2* si necesita atencion al cliente\n` +
    `Mande *4* si desea hacer un cambio a su pedido`
  );
}

function getMenu2(customerName) {
  return (
    `Gracias por su compra! ¿En que podemos ayudarle?\n\n` +
    `Mande *2* si necesita atencion al cliente\n` +
    `Mande *3* si desea hacer una orden nueva\n` +
    `Mande *4* si desea hacer un cambio a su pedido`
  );
}

function getWhatsAppStatus() {
  return {
    connected: isReady,
    reconnectAttempts,
    hasQR: !!currentQR,
  };
}

function getCurrentQR() {
  return currentQR;
}

function initWhatsApp() {
  if (client) return;

  const fs = require('fs');
  const path = require('path');

  const cacheBase = process.env.PUPPETEER_CACHE_DIR || path.join(process.cwd(), '.puppeteer');

  let chromePath = null;
  const possiblePaths = [
    path.join(cacheBase, 'chrome', 'win64-1045629', 'chrome-win32', 'chrome.exe'),
    path.join(cacheBase, 'chrome', 'win64-1045629', 'chrome-win', 'chrome.exe'),
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
  ];
  for (const p of possiblePaths) {
    try { if (fs.existsSync(p)) { chromePath = p; break; } } catch {}
  }

  const puppeteerConfig = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
    ],
  };
  if (chromePath) {
    puppeteerConfig.executablePath = chromePath;
    console.log(`[WhatsApp] Chrome encontrado: ${chromePath}`);
  } else {
    console.log('[WhatsApp] Chrome no encontrado. Descargá Chromium con: pnpm exec puppeteer browsers install chrome');
  }

  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: './.wwebjs_auth',
    }),
    puppeteer: puppeteerConfig,
  });

  client.on('qr', (qr) => {
    currentQR = qr;
    console.log('\n========================================');
    console.log(' Escaneá este código QR con WhatsApp:');
    console.log('========================================\n');
    qrcode.generate(qr, { small: true });
    console.log('\nEsperando escaneo...\n');
    console.log('QR también disponible en: GET /api/whatsapp/qr');
  });

  client.on('ready', async () => {
    console.log('WhatsApp conectado exitosamente');
    isReady = true;
    reconnectAttempts = 0;
    if (!accessInfoSent) {
      accessInfoSent = true;
      await sendAccessInfoToOwner();
    }
  });

  client.on('authenticated', () => {
    console.log('WhatsApp autenticado');
    currentQR = null;
    isReady = true;
  });

  client.on('auth_failure', (msg) => {
    console.error('Error de autenticación WhatsApp:', msg);
    isReady = false;
    client = null;
    scheduleReconnect();
  });

  client.on('error', (err) => {
    console.error('WhatsApp error:', err.message);
    if (err.message.includes('EBR') || err.message.includes('detached') || err.message.includes('Protocol') || err.message.includes('Execution context')) {
      isReady = false;
      client = null;
      scheduleReconnect();
    }
  });

  client.on('loading_screen', (percent, message) => {
    console.log(`[WhatsApp] Cargando: ${percent}% - ${message}`);
  });

  client.on('browser', (browser) => {
    console.log('[WhatsApp] Browser event recibido');
  });

  client.on('disconnected', (reason) => {
    console.log('WhatsApp desconectado:', reason);
    isReady = false;
    client = null;
    scheduleReconnect();
  });

  client.on('message', async (msg) => {
    try {
      if (msg.fromMe) return;
      const chat = await msg.getChat();
      if (chat.isGroup) return;

      const body = msg.body.trim();
      const sender = msg.from;
      const contact = await msg.getContact();
      const customerName = contact.pushname || 'Cliente';

      console.log(`Mensaje recibido de ${sender} (${customerName}): "${body.substring(0, 80)}${body.length > 80 ? '...' : ''}"`);

      // Solo el dueño puede pedir el mensaje de accesos (contiene la contraseña admin)
      if (OWNER_NUMBER && sender === `${OWNER_NUMBER}@c.us` && /^(accesos|acceso|links|link)$/i.test(body)) {
        await msg.reply(getAccessInfoMessage());
        console.log('Mensaje de accesos enviado al dueño (por comando).');
        return;
      }

      if (!AUTO_REPLY_ENABLED) {
        console.log('[MODO PRUEBA] Auto-reply desactivado');
        return;
      }

      const state = customerStates.get(sender) || 'new';
      const text = body.trim();

      if (state === 'new') {
        await msg.reply(getMenu1(customerName));
        customerStates.set(sender, 'menu1');
        console.log(`Menu 1 enviado a ${sender}`);
        return;
      }

      if (state === 'menu1') {
        if (text === '1') {
          const msg1 =
            `Hola ${customerName}, aqui tenes nuestro catalogo completo:\n\n` +
            `${STORE_URL}\n\n` +
            `Envio a domicilio, pago en efectivo.\n` +
            `Si necesitas algo mas, escribinos!`;
          await msg.reply(msg1);
          console.log(`Opcion 1 seleccionada por ${sender}`);
          return;
        }

        if (text === '2') {
          await handleOption2(sender, customerName, msg);
          return;
        }

        if (text === '4') {
          await handleOption4Start(sender, customerName, msg);
          return;
        }

        await msg.reply(getMenu1(customerName));
        return;
      }

      if (state === 'menu2') {
        if (text === '2') {
          await handleOption2(sender, customerName, msg);
          return;
        }

        if (text === '3') {
          const msg3 =
            `Hola ${customerName}, aqui tenes nuestro catalogo completo:\n\n` +
            `${STORE_URL}\n\n` +
            `Envio a domicilio, pago en efectivo.\n` +
            `Si necesitas algo mas, escribinos!`;
          await msg.reply(msg3);
          console.log(`Opcion 3 (orden nueva) seleccionada por ${sender}`);
          return;
        }

        if (text === '4') {
          await handleOption4Start(sender, customerName, msg);
          return;
        }

        await msg.reply(getMenu2(customerName));
        return;
      }

      if (state === 'option2') {
        const waitMsg =
          `Espere por favor, nuestro proveedor le respondra en breve.`;
        await msg.reply(waitMsg);

        if (OWNER_NUMBER) {
          try {
            const followMsg =
              `Mensaje de ${customerName} (${sender.replace('@c.us', '')}):\n"${body}"\n\nResponda directamente por este chat.`;
            await client.sendMessage(`${OWNER_NUMBER}@c.us`, followMsg);
          } catch (err) {
            console.error('Error reenviando mensaje al owner:', err.message);
          }
        }
        return;
      }

      if (state === 'option4_waiting_id') {
        const searchId = text.replace(/[^a-zA-Z0-9]/g, '');
        const order = await Order.findOne({
          _id: { $regex: searchId, $options: 'i' },
        }).sort({ createdAt: -1 });

        if (!order) {
          await msg.reply(
            `No se encontro ningun pedido con "${text}".\n\n` +
            `Intentelo de nuevo o escriba *menu* para volver al menu principal.`
          );
          return;
        }

        if (order.customer.phone?.replace(/[^0-9]/g, '') !== sender.replace('@c.us', '')) {
          await msg.reply(
            `El pedido #${order._id.toString().slice(-6).toUpperCase()} no pertenece a este numero.\n\n` +
            `Intentelo de nuevo o escriba *menu* para volver al menu principal.`
          );
          return;
        }

        const itemsList = order.items
          .map((item, i) =>
            `${i + 1}. ${item.quantity}x ${item.productName}${item.variant?.name ? ` (${item.variant.name})` : ''} - Q${item.subtotal.toLocaleString('es-GT')}`
          )
          .join('\n');

        await msg.reply(
          `Pedido #${order._id.toString().slice(-6).toUpperCase()} encontrado:\n\n` +
          `${itemsList}\n\n` +
          `Total: Q${order.total.toLocaleString('es-GT')}\n` +
          `Estado: ${order.orderStatus}\n\n` +
          `Escriba *menu* para volver al menu principal.\n` +
          `Un momento, notificaremos al proveedor sobre su cambio.`
        );

        if (OWNER_NUMBER) {
          try {
            const notifyMsg =
              `Cambio en pedido #${order._id.toString().slice(-6).toUpperCase()}:\n` +
              `Cliente: ${customerName}\n` +
              `Numero: ${sender.replace('@c.us', '')}\n\n` +
              `El cliente desea hacer un cambio al pedido.\n` +
              `Modifique el pedido desde el panel de administracion.`;
            await client.sendMessage(`${OWNER_NUMBER}@c.us`, notifyMsg);
            console.log(`Notificacion de cambio enviada al owner para pedido #${order._id.toString().slice(-6).toUpperCase()}`);
          } catch (err) {
            console.error('Error notificando al owner:', err.message);
          }
        }

        customerStates.set(sender, 'menu2');
        return;
      }

    } catch (error) {
      console.error('Error procesando mensaje:', error.message);
    }
  });

  client.initialize().catch((err) => {
    console.error('Error inicializando WhatsApp:', err.message);
    isReady = false;
    client = null;
    scheduleReconnect();
  });
}

async function handleOption2(sender, customerName, msg) {
  await msg.reply(
    `Hola ${customerName}, no se preocupe! Un momento por favor, sera atendido por nuestro proveedor.`
  );
  customerStates.set(sender, 'option2');

  if (OWNER_NUMBER) {
    try {
      const notifyMsg =
        `Atencion al cliente:\n` +
        `Nombre: ${customerName}\n` +
        `Numero: ${sender.replace('@c.us', '')}\n\n` +
        `El cliente necesita atencion, respondale por este chat.`;
      await client.sendMessage(`${OWNER_NUMBER}@c.us`, notifyMsg);
      console.log(`Notificacion de atencion enviada al owner para ${sender}`);
    } catch (err) {
      console.error('Error notificando al owner:', err.message);
    }
  }
}

async function handleOption4Start(sender, customerName, msg) {
  await msg.reply(
    `Para hacer un cambio, por favor escriba el numero de su pedido (ej: ABC123).\n\n` +
    `Si no recuerda el numero, escriba su nombre completo.`
  );
  customerStates.set(sender, 'option4_waiting_id');
  console.log(`Opcion 4 - esperando ID de pedido de ${sender}`);
}

function scheduleReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error(`Se alcanzó el máximo de ${MAX_RECONNECT_ATTEMPTS} intentos. Reiniciá el servidor manualmente.`);
    return;
  }

  reconnectAttempts++;
  const delay = RECONNECT_DELAY * reconnectAttempts;
  console.log(`Reintentando conexión en ${delay / 1000}s (intento ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);

  setTimeout(() => {
    console.log(`Intento de reconexión #${reconnectAttempts}...`);
    client = null;
    isReady = false;
    initWhatsApp();
  }, delay);
}

function formatOrderMessage(order) {
  const itemsList = order.items
    .map(
      (item) =>
        `  ${item.quantity}x ${item.productName}` +
        (item.variant?.name ? ` (${item.variant.name})` : '') +
        (item.extras?.length > 0
          ? ` + ${item.extras.map((e) => e.name).join(', ')}`
          : '') +
        ` ........... Q${item.subtotal.toLocaleString('es-GT')}`
    )
    .join('\n');

  const statusText = {
    pending: 'Pendiente',
    confirmed: 'Confirmado',
    preparing: 'En preparacion',
    in_transit: 'En camino',
    delivered: 'Entregado',
    cancelled: 'Cancelado',
  };

  const paymentText = order.paymentMethod === 'cash' ? 'Efectivo' : 'Tarjeta';

  return (
    `--- GRANJITA ---\n` +
    `NUEVO PEDIDO\n\n` +
    `Cliente: ${order.customer.name}\n` +
    `Telefono: ${order.customer.phone}\n` +
    `Direccion: ${order.customer.address}\n` +
    (order.customer.notes ? `Notas: ${order.customer.notes}\n` : '') +
    `\n--- PRODUCTOS ---\n${itemsList}\n` +
    `---------------------\n\n` +
    `Subtotal: Q${order.subtotal.toLocaleString('es-GT')}\n` +
    `Envio: ${order.deliveryFee > 0 ? 'Q' + order.deliveryFee.toLocaleString('es-GT') : 'Gratis'}\n` +
    `TOTAL: Q${order.total.toLocaleString('es-GT')}\n` +
    `Pago: ${paymentText}\n` +
    `Estado: ${statusText[order.orderStatus] || 'Pendiente'}\n\n` +
    `Pedido #${order._id.toString().slice(-6).toUpperCase()}`
  );
}

function formatInvoiceMessage(order) {
  const itemsList = order.items
    .map(
      (item) =>
        `  ${item.quantity}x ${item.productName}` +
        (item.variant?.name ? ` (${item.variant.name})` : '') +
        (item.extras?.length > 0
          ? ` + ${item.extras.map((e) => e.name).join(', ')}`
          : '') +
        ` ........... Q${item.subtotal.toLocaleString('es-GT')}`
    )
    .join('\n');

  const paymentText = order.paymentMethod === 'cash' ? 'Efectivo' : 'Tarjeta';

  return (
    `--- GRANJITA ---\n` +
    `FACTURA - Pedido #${order._id.toString().slice(-6).toUpperCase()}\n\n` +
    `Cliente: ${order.customer.name}\n` +
    `Telefono: ${order.customer.phone}\n` +
    `Direccion: ${order.customer.address}\n\n` +
    `--- PRODUCTOS ---\n${itemsList}\n` +
    `---------------------\n\n` +
    `Subtotal: Q${order.subtotal.toLocaleString('es-GT')}\n` +
    `Envio: ${order.deliveryFee > 0 ? 'Q' + order.deliveryFee.toLocaleString('es-GT') : 'Gratis'}\n` +
    `TOTAL: Q${order.total.toLocaleString('es-GT')}\n` +
    `Pago: ${paymentText}\n\n` +
    `Si tiene alguna consulta, escribanos por este chat.`
  );
}

async function sendOrderNotification(order) {
  if (!OWNER_NUMBER) {
    console.warn('OWNER_WHATSAPP no configurado. Omitiendo notificacion.');
    return;
  }

  if (!client || !isReady) {
    console.warn('WhatsApp no disponible. La notificacion no se envio.');
    return;
  }

  try {
    const formattedNumber = `${OWNER_NUMBER}@c.us`;
    const message = formatOrderMessage(order);
    await client.sendMessage(formattedNumber, message);
    console.log(`Notificacion enviada al dueño para pedido #${order._id.toString().slice(-6).toUpperCase()}`);

    const customerPhone = order.customer.phone?.replace(/[^0-9]/g, '');
    if (customerPhone) {
      const customerWaId = `${customerPhone}@c.us`;
      customerStates.set(customerWaId, 'menu2');
      console.log(`Estado del cliente ${customerPhone} cambiado a menu2 (post-compra)`);
    }
  } catch (error) {
    console.error('Error enviando notificacion WhatsApp:', error.message);
  }
}

async function sendInvoiceToCustomer(order) {
  if (!client || !isReady) {
    console.warn('WhatsApp no disponible. La factura no se envio.');
    return false;
  }

  const phone = order.customer.phone?.replace(/[^0-9]/g, '');
  if (!phone) {
    console.warn('Telefono del cliente no valido.');
    return false;
  }

  try {
    const formattedNumber = `${phone}@c.us`;
    const message = formatInvoiceMessage(order);
    await client.sendMessage(formattedNumber, message);
    console.log(`Factura enviada al cliente ${phone} para pedido #${order._id.toString().slice(-6).toUpperCase()}`);
    return true;
  } catch (error) {
    console.error('Error enviando factura al cliente:', error.message);
    return false;
  }
}

async function sendOrderOnWayNotification(order) {
  if (!client || !isReady) {
    console.warn('WhatsApp no disponible. No se pudo enviar notificacion.');
    return false;
  }

  const phone = order.customer.phone?.replace(/[^0-9]/g, '');
  if (!phone) {
    console.warn('Telefono del cliente no valido.');
    return false;
  }

  try {
    const formattedNumber = `${phone}@c.us`;
    const message =
      `Su pedido #${order._id.toString().slice(-6).toUpperCase()} esta en camino!\n\n` +
      `Cliente: ${order.customer.name}\n` +
      `Direccion: ${order.customer.address}\n\n` +
      `Pronto estara con usted. Gracias por su compra!`;
    await client.sendMessage(formattedNumber, message);
    console.log(`Notificacion de envio enviada al cliente ${phone} para pedido #${order._id.toString().slice(-6).toUpperCase()}`);
    return true;
  } catch (error) {
    console.error('Error enviando notificacion de envio:', error.message);
    return false;
  }
}

function getAccessInfoMessage() {
  const store = STORE_URL.replace(/\/+$/, '');
  const backend = BACKEND_URL.replace(/\/+$/, '');
  const adminPassword = process.env.ADMIN_PASSWORD || '';

  return (
    `*La Granjita - accesos*\n\n` +
    `🛒 Tienda:\n` +
    `${store}\n\n` +
    `🔐 Admin:\n` +
    `${store}/admin/login\n` +
    `Contraseña: ${adminPassword}\n\n` +
    `1) Abra el enlace del Admin\n` +
    `2) Ingrese la contraseña\n` +
    `3) Gestione pedidos, productos y stock\n\n` +
    `Backend (tecnico):\n` +
    `${backend}/api/health\n\n` +
    `Nota: la primera carga puede tardar un poco (servidor free).`
  );
}

async function sendAccessInfoToOwner() {
  if (!OWNER_NUMBER) {
    console.warn('OWNER_WHATSAPP no configurado. No se envio el mensaje de accesos.');
    return false;
  }

  if (!client || !isReady) {
    console.warn('WhatsApp no disponible. No se envio el mensaje de accesos.');
    return false;
  }

  try {
    const formattedNumber = `${OWNER_NUMBER}@c.us`;
    await client.sendMessage(formattedNumber, getAccessInfoMessage());
    console.log('Mensaje de accesos enviado al dueño.');
    return true;
  } catch (error) {
    console.error('Error enviando mensaje de accesos al dueño:', error.message);
    return false;
  }
}

async function startWhatsApp() {
  initWhatsApp();
}

async function sendTestMessage(toNumber) {
  if (!client || !isReady) {
    throw new Error('WhatsApp no esta conectado');
  }
  const formattedNumber = `${toNumber}@c.us`;
  await client.sendMessage(formattedNumber, 'Mensaje de prueba - GRANJITA. Si ves este mensaje, WhatsApp esta funcionando correctamente.');
}

module.exports = {
  sendOrderNotification,
  sendInvoiceToCustomer,
  sendOrderOnWayNotification,
  sendAccessInfoToOwner,
  getAccessInfoMessage,
  sendTestMessage,
  startWhatsApp,
  getWhatsAppStatus,
  getCurrentQR,
};
