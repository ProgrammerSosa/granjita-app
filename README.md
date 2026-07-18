# La Granjita — Pedidos a domicilio

Sistema completo de **tienda online + panel de administración** para un negocio de productos frescos a domicilio (San José Pinula, Guatemala).

Ideal para quien compra o recibe el proyecto: aquí está **qué hace**, **cómo arrancarlo**, **credenciales** y **cómo usarlo**.

---

## ¿Qué es?

Una app web donde:

| Quién | Qué puede hacer |
|--------|------------------|
| **Cliente** | Ve el catálogo, arma el carrito, elige unidad o peso, paga en efectivo (con billetes) o con terminal POS en casa, recibe avisos por WhatsApp |
| **Dueño / admin** | Gestiona productos, stock, pedidos en vivo, horarios, facturas, estadísticas y WhatsApp del negocio |

**Stack**

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js 14, React 18, Tailwind, Zustand, Recharts |
| Backend | Node.js, Express, MongoDB |
| Mensajes | WhatsApp Web (`whatsapp-web.js`) — se vincula **una sola vez** |
| Pagos | Efectivo al entregar · Tarjeta con POS en la casa del cliente |

---

## Credenciales y accesos (listo para usar)

### Panel administrador

| Dato | Valor |
|------|--------|
| **URL login** | http://127.0.0.1:3000/admin/login |
| **Contraseña** | `emadiana123` |
| Variable en backend | `ADMIN_PASSWORD` en `backend/.env` |

También podés abrir el admin desde la tienda: **10 toques al logo** (aparece el ícono de engranaje).

### Tienda (cliente)

| Dato | Valor |
|------|--------|
| **URL** | http://127.0.0.1:3000 |
| **Acerca de (ayuda al cliente)** | http://127.0.0.1:3000/acerca-de |

### API / Backend

| Dato | Valor |
|------|--------|
| **API** | http://127.0.0.1:5000 |
| **Health** | http://127.0.0.1:5000/api/health |

### WhatsApp del negocio

| Dato | Valor |
|------|--------|
| **Número dueño (ejemplo)** | Configurado en `.env` como `OWNER_WHATSAPP` (ej. `50254973412`) |
| **Vincular WhatsApp** | Solo desde **Admin → WhatsApp** (protegido con login) |
| **Sesión guardada** | `%USERPROFILE%\.tienda-wwebjs-auth` (Windows) — **no borrar** si no querés volver a escanear |

> **Importante:** al publicar o entregar a un cliente final, cambiale la contraseña admin y el `JWT_SECRET` en `backend/.env`.

---

## Arranque rápido (Windows)

### Opción A — scripts

```bat
cd C:\Users\PC\tienda
start-all.bat
```

### Opción B — dos terminales

**1. Backend** (dejar abierta):

```bat
cd C:\Users\PC\tienda\backend
copy .env.example .env
npm install
npm run dev
```

**2. Frontend** (otra ventana):

```bat
cd C:\Users\PC\tienda\frontend
copy .env.example .env.local
npm install
npm run dev
```

Requisitos:

- **Node.js** instalado  
- **MongoDB** corriendo en `mongodb://127.0.0.1:27017/tienda`  
- **Google Chrome** (para WhatsApp Web)

Si ves `EADDRINUSE` en el puerto 5000, ya hay un backend corriendo: cerralo o liberá el puerto antes de abrir otro.

---

## Qué incluye el sistema (resumen de lo construido)

### Tienda (cliente)

- Marca **La Granjita** (logo, colores, textos)
- Catálogo, búsqueda, categorías, destacados
- **Variantes por unidad y/o peso** (el admin decide; el cliente elige)
  - En admin solo ponés el número: `5` + Unidad → **“5 unidades”**; `5` + Peso → **“5 lb”**
- Carrito y checkout
- **Pedido mínimo Q 15**
- **Horario:** lun–sáb, 10:30 am–3:00 pm y 4:00 pm–8:00 pm (receso 3–4 pm)
- **Domingo cerrado** por defecto (el admin puede habilitar un domingo puntual)
- Descansos planificados y cierre de emergencia
- **Zona de entrega:** solo residenciales de **San José Pinula**
- Pago: efectivo (billetes + vuelto) o POS en casa
- Aviso amable si la tienda está cerrada
- Página **Acerca de** explicando cómo pedir
- Botón WhatsApp

### Panel admin

| Ruta | Para qué sirve |
|------|----------------|
| `/admin` | **Dashboard** — cola de pedidos de la **última hora** (el más antiguo primero), cambiar estados al toque |
| `/admin/stats` | **Estadísticas** con gráficos (ventas por hora, 7 días, pagos, top productos) |
| `/admin/stock` | **Inventario** — reponer, ver bajo/agotado |
| `/admin/products` | Productos, variantes, stock, destacados |
| `/admin/categories` | Categorías |
| `/admin/orders` | Todos los pedidos, facturas, billetes |
| `/admin/invoices` | Listado de facturas |
| `/admin/store` | Calendario: descansos, domingos especiales, mínimo, cierre |
| `/admin/whatsapp` | Vincular WA (código o QR), prueba, desvincular |
| `/admin/about` | Manual del panel |

Menú lateral **plegable** con el botón **☰ Menú** (arriba a la izquierda).  
**Campana 🔔** de alertas de stock en la barra superior.

### Stock y alertas

- Cada venta **descuenta stock**
- Si quedan **≤ umbral** (por defecto 5) → aviso en la campana + **WhatsApp al dueño**
- Si llega a **0** → se marca **Agotado** en la tienda + aviso

### WhatsApp (negocio)

- Vinculación **una sola vez** (sesión en el PC)
- Nuevo pedido → aviso al dueño
- Confirmación y factura al cliente
- Menús automáticos (pedido, atención, modificar)
- Alertas de stock bajo / agotado

### Seguridad

- Rutas de admin con **JWT** (sin contraseña → **401**)
- Rate limit en login y API
- QR de WhatsApp **solo con login admin**
- Facturas y reenvíos protegidos
- `.env` no se sube a Git

---

## Flujo del pedido (estados)

En el dashboard o en Pedidos podés avanzar:

```
Nuevo → Confirmado → En proceso → Listo / En camino → Entregado
                         ↘ Cancelado
```

- **En camino:** se trabaja con factura PDF y avisos WhatsApp  
- En la cola del dashboard, el **#1** es el más antiguo de la última hora (atenderlo primero)

---

## Productos: unidad y peso

1. En **Productos**, marcá **Por unidad**, **Por peso**, o **ambas**.  
2. Agregá variantes solo con **cantidad (número)** + **precio Q**.  
3. El sistema genera el nombre:
   - `5` + unidad → **5 unidades**
   - `5` + peso → **5 lb**
4. Si hay **ambas** formas, el cliente en la tienda elige primero “por unidad” o “por peso” y después la opción.

No hay precio general arriba: **el precio es el de cada variante**. En la tarjeta se muestra “desde Q …”.

---

## Variables de entorno

### `backend/.env` (copiar de `.env.example`)

| Variable | Ejemplo | Uso |
|----------|---------|-----|
| `ADMIN_PASSWORD` | `emadiana123` | Login del panel |
| `JWT_SECRET` | string largo | Firma de tokens admin |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/tienda` | Base de datos |
| `OWNER_WHATSAPP` | `50254973412` | WhatsApp del dueño |
| `STORE_URL` | URL de la tienda | Links en mensajes WA |
| `CORS_ORIGIN` | URLs del frontend | Orígenes permitidos |
| `WA_PUBLIC_PANEL` | `false` | No exponer QR en la raíz del API |

### `frontend/.env.local`

| Variable | Ejemplo | Uso |
|----------|---------|-----|
| `NEXT_PUBLIC_API_URL` | `http://127.0.0.1:5000/api` | Backend |
| `NEXT_PUBLIC_WHATSAPP` | `50254973412` | Botón flotante WA |

---

## Estructura del proyecto

```
tienda/  (repo: granjita-app)
├── frontend/          # Next.js — tienda + admin
│   ├── public/        # logo la-granjita.png, favicon
│   └── src/
│       ├── app/       # páginas (/, /admin/*, /acerca-de)
│       ├── components/
│       ├── lib/
│       └── store/
├── backend/           # Express + Mongo + WhatsApp
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/  # WA, stock, horarios, facturas
│   │   └── middleware/ # auth + seguridad
│   └── data/          # settings y alertas (local, no git)
├── start-all.bat
├── start-all.ps1
└── README.md
```

Repo GitHub: https://github.com/ProgrammerSosa/granjita-app

---

## Checklist para el comprador / dueño nuevo

1. [ ] Instalar Node.js y MongoDB  
2. [ ] Copiar `.env` y `.env.local` desde los examples  
3. [ ] Poner tu `OWNER_WHATSAPP` y `NEXT_PUBLIC_WHATSAPP`  
4. [ ] `npm install` en backend y frontend  
5. [ ] Arrancar backend y frontend  
6. [ ] Entrar a admin con `emadiana123` (y **cambiar** la clave si es producción)  
7. [ ] Admin → WhatsApp → vincular el número (una vez)  
8. [ ] Crear categorías y productos (con variantes unidad/peso)  
9. [ ] Probar un pedido de prueba en la tienda  
10. [ ] Revisar cola en Dashboard y stock  

---

## Problemas frecuentes

| Problema | Solución |
|----------|----------|
| `EADDRINUSE :::5000` | Ya hay un backend; cerralo o matá el proceso del puerto 5000 |
| ERR_CONNECTION_REFUSED | Falta arrancar frontend y/o backend |
| Stats / stock en 404 | Reiniciá el backend para cargar el código nuevo |
| WhatsApp pide QR otra vez | No borres `.tienda-wwebjs-auth`; no desvincules el dispositivo |
| Login admin no entra | Revisá `ADMIN_PASSWORD` en `backend/.env` y reiniciá backend |

---

## Licencia / uso

Uso personal o comercial del dueño del proyecto / comprador del sistema.

---

**La Granjita** — de la granja a tu puerta · San José Pinula
