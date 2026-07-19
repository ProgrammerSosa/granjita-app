# Desplegar La Granjita en Render

Guía para el monorepo (frontend Next.js + backend Express).  
**MongoDB** se recomienda con **MongoDB Atlas** (gratis).

**Repo:** https://github.com/ProgrammerSosa/granjita-app

---

## Arquitectura en Render

| Servicio | Root | Plan típico |
|----------|------|-------------|
| **granjita-backend** | `backend` | Free / Starter |
| **granjita-frontend** | `frontend` | Free / Starter |
| **MongoDB** | Atlas (externo) | Free M0 |

> Render ya no ofrece MongoDB “de un click” tan simple como antes. Atlas es lo más estable.

---

## 1. MongoDB Atlas (5–10 min)

1. Entrá a [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) y creá cuenta.  
2. **Build a Database** → plan **FREE (M0)**.  
3. Usuario y contraseña de base de datos (guardalos).  
4. **Network Access** → **Allow Access from Anywhere** (`0.0.0.0/0`) — necesario para Render.  
5. **Connect** → **Drivers** → copiá el connection string, tipo:

```
mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/tienda?retryWrites=true&w=majority
```

Reemplazá `USER`, `PASS` y el nombre de DB (`tienda`).

---

## 2. Opción A — Blueprint (recomendada)

1. Entrá a [https://dashboard.render.com](https://dashboard.render.com).  
2. **New** → **Blueprint**.  
3. Conectá el repo **`ProgrammerSosa/granjita-app`** (branch `master`).  
4. Render lee `render.yaml` y propone:
   - `granjita-backend`
   - `granjita-frontend`
5. Completá las variables que digan que faltan (ver tablas abajo).  
6. **Apply**.

---

## 3. Opción B — Servicios a mano

### 3.1 Backend

1. **New** → **Web Service**.  
2. Repo: `granjita-app`.  
3. Config:

| Campo | Valor |
|--------|--------|
| Name | `granjita-backend` |
| Root Directory | `backend` |
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance | Free |

4. **Environment** (variables):

| Key | Value |
|-----|--------|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | *(connection string de Atlas)* |
| `ADMIN_PASSWORD` | `emadiana123` |
| `JWT_SECRET` | *(string largo; ver abajo)* |
| `OWNER_WHATSAPP` | `502XXXXXXXX` |
| `WHATSAPP_ENABLED` | `false` |
| `WHATSAPP_AUTO_REPLY` | `true` |
| `WHATSAPP_FIRST_MSG_OF_DAY` | `true` |
| `WA_PUBLIC_PANEL` | `false` |
| `CORS_ORIGIN` | *(después: URL del frontend, sin `/` final)* |
| `STORE_URL` | *(misma URL del frontend)* |

JWT:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

5. **Create Web Service** y esperá el deploy.  
6. Copiá la URL pública, ej:  
   `https://granjita-backend.onrender.com`  
7. Probá: `https://granjita-backend.onrender.com/api/health`

### 3.2 Frontend

1. **New** → **Web Service**.  
2. Mismo repo.  
3. Config:

| Campo | Valor |
|--------|--------|
| Name | `granjita-frontend` |
| Root Directory | `frontend` |
| Runtime | Node |
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |
| Instance | Free |

4. **Environment**:

| Key | Value |
|-----|--------|
| `NODE_ENV` | `production` |
| `NEXT_PUBLIC_API_URL` | `https://granjita-backend.onrender.com/api` |
| `NEXT_PUBLIC_WHATSAPP` | `502XXXXXXXX` |

5. Deploy y copiá la URL, ej:  
   `https://granjita-frontend.onrender.com`

### 3.3 Cerrar el círculo (CORS)

En el **backend**, editá variables:

```
CORS_ORIGIN=https://granjita-frontend.onrender.com
STORE_URL=https://granjita-frontend.onrender.com
```

**Manual Deploy** del backend otra vez.

Si cambiaste `NEXT_PUBLIC_API_URL`, redeploy del **frontend** también (esas variables se fijan en el build).

---

## 4. Orden de trabajo

```
1. Atlas MongoDB
2. Backend en Render  → health OK
3. Frontend en Render → tienda carga
4. Backend: CORS_ORIGIN + STORE_URL
5. Redeploy backend
6. Probar admin y un pedido
```

---

## 5. Probar en producción

| Qué | URL |
|-----|-----|
| Tienda | `https://granjita-frontend.onrender.com` |
| Admin | `https://granjita-frontend.onrender.com/admin/login` |
| Contraseña | `emadiana123` (o la de `ADMIN_PASSWORD`) |
| API | `https://granjita-backend.onrender.com/api/health` |

Checklist:

- [ ] Health del backend responde `ok`  
- [ ] La tienda lista productos (aunque esté vacía)  
- [ ] Login admin funciona  
- [ ] Crear categoría + producto  
- [ ] Pedido de prueba  
- [ ] Dashboard muestra el pedido  

---

## 6. Free tier de Render — cosas a saber

1. **Cold start:** si nadie usa el servicio ~15 min, se duerme. El primer request puede tardar 30–60 s.  
2. **Dos servicios free** (front + back) cuentan en tu plan.  
3. Los **discos se reinician** en redeploy: fotos en `uploads/` y sesión WhatsApp no son permanentes sin disco persistente de pago.  
4. **WhatsApp:** dejá `WHATSAPP_ENABLED=false` en Render. Conectar WA es más fiable en un PC o VPS. La tienda funciona igual.

---

## 7. Variables (copiar/pegar)

### Backend

```
NODE_ENV=production
MONGODB_URI=mongodb+srv://USER:PASS@cluster0.xxx.mongodb.net/tienda?retryWrites=true&w=majority
ADMIN_PASSWORD=emadiana123
JWT_SECRET=pega_aqui_el_secreto_largo
OWNER_WHATSAPP=502XXXXXXXX
CORS_ORIGIN=https://granjita-frontend.onrender.com
STORE_URL=https://granjita-frontend.onrender.com
WHATSAPP_ENABLED=false
WHATSAPP_AUTO_REPLY=true
WHATSAPP_FIRST_MSG_OF_DAY=true
WA_PUBLIC_PANEL=false
```

### Frontend

```
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://granjita-backend.onrender.com/api
NEXT_PUBLIC_WHATSAPP=502XXXXXXXX
```

---

## 8. Errores frecuentes

| Problema | Solución |
|----------|----------|
| Backend crashea al arrancar | Falta `MONGODB_URI` o `JWT_SECRET` corto / `ADMIN_PASSWORD=admin123` (bloqueado en prod) |
| Frontend sin productos / red error | `NEXT_PUBLIC_API_URL` mal (debe terminar en `/api`) o backend dormido |
| CORS en consola del browser | `CORS_ORIGIN` debe ser **exactamente** la URL del frontend (https, sin `/` al final) |
| Build frontend falla | Root Directory = `frontend`; revisá logs de build |
| Mongo “IP not allowed” | En Atlas → Network Access → `0.0.0.0/0` |
| Admin no entra | Redeploy backend tras cambiar `ADMIN_PASSWORD` |

---

## 9. Blueprint (`render.yaml`)

El archivo en la raíz del repo ya define ambos servicios.  
Las claves con `sync: false` las completás en el dashboard (secretos).

---

## Resumen

| Paso | Acción |
|------|--------|
| 1 | Atlas → DB free + connection string |
| 2 | Render → backend (`root: backend`) |
| 3 | Render → frontend (`root: frontend`) |
| 4 | Enlazar CORS / STORE_URL / API URL |
| 5 | Probar tienda + admin |

¿Dudas? Revisá los **Logs** del servicio que falle en el dashboard de Render.
