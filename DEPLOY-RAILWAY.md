# Desplegar La Granjita en Railway

Guía paso a paso para subir el monorepo (frontend + backend + MongoDB).

**Repo:** https://github.com/ProgrammerSosa/granjita-app

---

## Qué vas a crear en Railway

| Servicio | Root Directory | Rol |
|----------|----------------|-----|
| **MongoDB** | — (plugin) | Base de datos |
| **backend** | `backend` | API Express + WhatsApp (opcional) |
| **frontend** | `frontend` | Tienda Next.js + Admin |

---

## 1. Cuenta y proyecto

1. Entrá a [https://railway.app](https://railway.app) e iniciá sesión (GitHub).
2. **New Project** → **Deploy from GitHub repo**.
3. Elegí el repo **`ProgrammerSosa/granjita-app`** (o el tuyo).
4. Si Railway crea un servicio automático en la raíz, **borralo** o no lo uses: necesitamos servicios con carpeta `backend` y `frontend` por separado.

---

## 2. Agregar MongoDB

1. En el proyecto: **+ New** → **Database** → **MongoDB**.
2. Cuando esté listo, abrí el servicio MongoDB → **Variables**.
3. Copiá la variable **`MONGO_URL`** (o `DATABASE_URL` / connection string).  
   La vas a pegar en el backend como `MONGODB_URI`.

---

## 3. Servicio Backend

1. **+ New** → **GitHub Repo** → mismo repo `granjita-app`.
2. En el servicio nuevo:
   - **Settings** → **Root Directory** = `backend`
   - **Settings** → **Watch Paths** (opcional): `backend/**`
3. **Settings** → **Networking** → **Generate Domain**  
   Anotá la URL, ej: `https://granjita-backend-production.up.railway.app`
4. **Variables** → agregá:

| Variable | Valor | Notas |
|----------|--------|--------|
| `NODE_ENV` | `production` | Obligatorio |
| `MONGODB_URI` | *(pegar MONGO_URL de MongoDB)* | Obligatorio |
| `ADMIN_PASSWORD` | `emadiana123` | O la que quieras (login admin) |
| `JWT_SECRET` | *(string largo aleatorio)* | Mín. 32 caracteres |
| `CORS_ORIGIN` | `https://TU-FRONTEND.up.railway.app` | URL del frontend (paso 4) |
| `STORE_URL` | `https://TU-FRONTEND.up.railway.app` | Misma URL pública de la tienda |
| `OWNER_WHATSAPP` | `502XXXXXXXX` | Tu WhatsApp con código de país |
| `WHATSAPP_ENABLED` | `false` | **Recomendado al inicio** (ver nota WA abajo) |
| `WHATSAPP_AUTO_REPLY` | `true` | Si activás WA después |
| `WHATSAPP_FIRST_MSG_OF_DAY` | `true` | |
| `WA_PUBLIC_PANEL` | `false` | No exponer QR público |
| `PORT` | *(Railway lo pone solo)* | No hace falta crearla |

Generar `JWT_SECRET` en tu PC:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

5. **Deploy** / redeploy del backend.
6. Probá: `https://TU-BACKEND.up.railway.app/api/health`  
   Debe responder `{"status":"ok",...}`.

---

## 4. Servicio Frontend

1. **+ New** → **GitHub Repo** → mismo repo.
2. Settings:
   - **Root Directory** = `frontend`
   - **Watch Paths** (opcional): `frontend/**`
3. **Generate Domain** → anotá la URL, ej:  
   `https://granjita-frontend-production.up.railway.app`
4. **Variables**:

| Variable | Valor |
|----------|--------|
| `NEXT_PUBLIC_API_URL` | `https://TU-BACKEND.up.railway.app/api` |
| `NEXT_PUBLIC_WHATSAPP` | `502XXXXXXXX` (mismo del negocio) |

> `NEXT_PUBLIC_*` se “hornean” en el **build**. Si cambiás la URL del API, **redeploy** del frontend.

5. Volvé al **backend** y actualizá (si aún no lo hiciste):
   - `CORS_ORIGIN` = URL del frontend (sin barra final)
   - `STORE_URL` = URL del frontend  
   Luego **redeploy** del backend.

6. Deploy del frontend. Abrí la URL pública de la tienda.

---

## 5. Orden recomendado de deploys

```
1. MongoDB
2. Backend  (con MONGODB_URI)
3. Frontend (con NEXT_PUBLIC_API_URL del backend)
4. Backend  de nuevo (CORS_ORIGIN + STORE_URL del frontend)
```

---

## 6. Probar en producción

| Qué | URL |
|-----|-----|
| Tienda | `https://TU-FRONTEND.up.railway.app` |
| Admin | `https://TU-FRONTEND.up.railway.app/admin/login` |
| Contraseña admin | la de `ADMIN_PASSWORD` (ej. `emadiana123`) |
| API health | `https://TU-BACKEND.up.railway.app/api/health` |

Checklist:

1. [ ] Catálogo carga productos  
2. [ ] Login admin funciona  
3. [ ] Crear categoría / producto  
4. [ ] Hacer un pedido de prueba  
5. [ ] Ver pedido en Dashboard  

---

## 7. WhatsApp en Railway (importante)

WhatsApp Web (`whatsapp-web.js`) en Railway es **delicado**:

- Necesita Chrome/Chromium  
- El disco es **efímero**: al redeploy se puede **perder la sesión** y pedir QR otra vez  
- No es ideal escanear QR en un servidor cloud sin volumen persistente  

**Recomendación al debutar:**

```env
WHATSAPP_ENABLED=false
```

La tienda y el admin funcionan igual; solo no manda mensajes WA.

**Si querés WA en la nube más adelante:**

1. Activá `WHATSAPP_ENABLED=true`  
2. Agregá un **Volume** en el servicio backend montado p.ej. en `/data/wa`  
3. Variable: `WA_AUTH_PATH=/data/wa`  
4. Puede hacer falta instalar Chromium en Nixpacks (complejo)  
5. Alternativa más estable: dejar el backend WA en un **PC/VPS** y solo la web en Railway  

Para el comprador: **podés usar el sistema completo sin WhatsApp** y conectar WA en local o VPS.

---

## 8. Imágenes de productos (uploads)

Las fotos se guardan en `backend/uploads/`. En Railway el disco se borra en redeploy salvo que montés un **Volume**:

- Volume path: `/app/uploads` (o la ruta de trabajo del servicio)  
- O usar un storage externo (S3, Cloudinary) en una mejora futura  

---

## 9. Variables de referencia (copiar/pegar)

### Backend

```
NODE_ENV=production
MONGODB_URI=<de Railway Mongo>
ADMIN_PASSWORD=emadiana123
JWT_SECRET=<generado>
CORS_ORIGIN=https://xxxx.up.railway.app
STORE_URL=https://xxxx.up.railway.app
OWNER_WHATSAPP=502XXXXXXXX
WHATSAPP_ENABLED=false
WHATSAPP_AUTO_REPLY=true
WHATSAPP_FIRST_MSG_OF_DAY=true
WA_PUBLIC_PANEL=false
```

### Frontend

```
NEXT_PUBLIC_API_URL=https://yyyy.up.railway.app/api
NEXT_PUBLIC_WHATSAPP=502XXXXXXXX
```

---

## 10. Problemas comunes

| Error | Qué hacer |
|-------|-----------|
| Frontend no carga productos | `NEXT_PUBLIC_API_URL` mal o backend caído; revisá health |
| CORS error en el navegador | `CORS_ORIGIN` del backend debe ser la URL exacta del frontend (https, sin `/` final) |
| Backend exit por seguridad | Falta `JWT_SECRET` largo o `MONGODB_URI` o `ADMIN_PASSWORD` débil tipo `admin123` |
| Build frontend falla | Root Directory = `frontend`; logs de build en Railway |
| 502 en la web | Servicio no levantó; mirá logs Deploy |

---

## Resumen

1. Proyecto desde GitHub  
2. MongoDB + Backend (`backend`) + Frontend (`frontend`)  
3. Variables de entorno  
4. Dominios públicos  
5. Probar tienda y admin  
6. WhatsApp: opcional / mejor después  

Si algo falla, copiá el log de **Deploy** del servicio que cae y revisalo línea por línea.
