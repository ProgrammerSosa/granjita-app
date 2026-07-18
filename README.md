# TIENDA — Productos frescos a domicilio

App de pedidos a domicilio: catálogo, carrito, checkout (efectivo / terminal POS en casa), panel admin, facturas y **WhatsApp**.

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js 14, React 18, Tailwind, Zustand |
| Backend | Node.js, Express, MongoDB |
| Pagos | Efectivo al entregar · Tarjeta con POS en casa |
| Mensajes | WhatsApp Web (`whatsapp-web.js`) |

## Estructura

```
tienda/
├── frontend/     # Tienda + panel admin
├── backend/      # API + WhatsApp
│   └── data/     # wa-daily-greetings.json (auto)
└── README.md
```

## Arranque local (Windows)

### 1. Backend (dejar la ventana abierta)

```bat
cd C:\Users\PC\tienda\backend
copy .env.example .env
npm install
node server.js
```

- API: http://127.0.0.1:5000  
- QR WhatsApp: http://127.0.0.1:5000/  

### 2. Frontend (otra ventana, dejar abierta)

```bat
cd C:\Users\PC\tienda\frontend
copy .env.example .env.local
npm install
npm run dev
```

- Tienda: http://127.0.0.1:3000  
- Admin: http://127.0.0.1:3000/admin/login  
- PIN / password admin: el de `ADMIN_PASSWORD` en `.env` (ej. `admin123`)

> Si ves **ERR_CONNECTION_REFUSED**, el frontend o el backend se apagaron. Volvé a abrir las dos ventanas CMD.

---

## WhatsApp — cómo funciona

### Conectar el número (una vez)

1. Arrancá el **backend** (`node server.js`)
2. Abrí http://127.0.0.1:5000/
3. Escaneá el **QR** con el WhatsApp del negocio:  
   *Dispositivos vinculados → Vincular un dispositivo*
4. Cuando diga **WhatsApp CONECTADO**, listo

La sesión se guarda en `backend/.wwebjs_auth/` (no la borres si no querés volver a escanear).

### Menú WhatsApp (como “switch” de opciones)

El cliente responde con **números** (1, 2, 3). Es lo más estable en WhatsApp Web.

#### A) Primer mensaje del día → menú de 3 opciones

```
1️⃣  Realizar un pedido     → manda el link de la página
2️⃣  Atención al cliente    → avisa al dueño (OWNER_WHATSAPP) que quiere hablar
3️⃣  Modificar un pedido    → pide que escriba el cambio (antes de reparto)
```

#### B) Después de hacer un pedido (web) → menú de 2 opciones

Al confirmar el pedido por la tienda, el cliente recibe en WhatsApp:

```
1️⃣  Realizar otro pedido   → otra vez el link
2️⃣  Modificar este pedido  → "escribí tu cambio antes de que salga a reparto"
```

Si elige modificar y manda el texto, **vos** recibís la solicitud en `OWNER_WHATSAPP` con el # de pedido.

#### Variables

| Variable | Valor | Qué hace |
|----------|-------|----------|
| `WHATSAPP_AUTO_REPLY` | `true` | Activa menús y auto-respuestas |
| `WHATSAPP_FIRST_MSG_OF_DAY` | `true` | El saludo+menú 3 sale en el 1.er msg del día |
| `OWNER_WHATSAPP` | `502...` | Recibe pedidos, atención y cambios |
| `STORE_URL` | URL tienda | Link de la opción 1 |

Sesiones del menú:

```
backend/data/wa-sessions.json
```

Para resetear menús del día: borrá ese archivo y reiniciá el backend.

### Otros mensajes de WhatsApp

| Evento | A quién | Contenido |
|--------|---------|-----------|
| Nuevo pedido | `OWNER_WHATSAPP` | Detalle + billetes si dijo efectivo |
| Pedido creado | Cliente | Confirmación |
| Cambio de estado | Cliente | En camino (con **factura**), entregado, etc. |

### Variables WhatsApp en `.env`

```env
STORE_URL=http://127.0.0.1:3000
OWNER_WHATSAPP=50255551234
WHATSAPP_AUTO_REPLY=true
WHATSAPP_FIRST_MSG_OF_DAY=true
```

- `STORE_URL` → link que se manda en el saludo  
- `OWNER_WHATSAPP` → tu número (código país, sin `+`)

---

## Pagos (negocio)

| Método | En la app | En la entrega |
|--------|-----------|---------------|
| **Efectivo** | Cliente indica billetes / monedas / **Pago cabal** | Se cobra en la puerta |
| **Tarjeta** | Elige POS | Llevás el **terminal** a la casa |

- La **factura** se genera al pasar el pedido a **En camino** (`TDA-2026-00001`).
- En la factura figuran los **billetes** con los que paga el cliente y el **vuelto cabal** que debe llevar el repartidor.
- Al marcar *En camino*, WhatsApp manda esa factura al dueño (`OWNER_WHATSAPP`) para el reparto.
- En admin → Pedidos podés registrar el cobro real en efectivo.

---

## Admin

| Ruta | Uso |
|------|-----|
| `/admin/login` | Entrar |
| `/admin` | Dashboard |
| `/admin/categories` | Crear / ocultar / borrar categorías |
| `/admin/products` | Productos + destacados |
| `/admin/orders` | Estados, factura, billetes |

Tuerca del admin en la tienda: **10 toques al logo** (sin contador visible).

---

## API rápida

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/health` | — | Estado + WhatsApp |
| POST | `/api/auth/login` | — | `{ "password" }` |
| GET | `/api/categories` | — | Categorías activas |
| GET | `/api/products` | — | Catálogo |
| POST | `/api/orders` | — | Crear pedido (+ `cashIntent`) |
| GET | `/api/orders/admin` | JWT | Pedidos |
| PATCH | `/api/orders/:id/status` | JWT | Estado (factura en `in_transit`) |
| POST | `/api/orders/:id/cash-payment` | JWT | Cobro efectivo real |

---

## Seguridad

- Cambiá `ADMIN_PASSWORD` y `JWT_SECRET` en producción  
- No subas `.env` ni `.wwebjs_auth/`  
- CORS permite `localhost` y `127.0.0.1` en desarrollo  

## Licencia

Uso personal / comercial del dueño del proyecto.
