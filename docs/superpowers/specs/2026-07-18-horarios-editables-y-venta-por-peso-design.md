# Diseño: horarios editables + venta por peso (0.5 en 0.5)

**Fecha:** 2026-07-18
**Proyecto:** La Granjita (backend Node/Express + Mongo, frontend Next.js 14)
**Carpeta de trabajo:** `C:\2024449\tienda` (sincronizada con `origin/master` = producción en Render)

## Objetivo

Dos features pedidas por el dueño de la tienda:

1. **Horarios editables desde el admin.** Hoy los turnos (10:30–15:00, receso, 16:00–20:00)
   están guardados pero no se pueden cambiar desde el panel. El dueño quiere editar el
   turno 1, el receso y el turno 2, y poder agregar o quitar un turno.
2. **Venta por peso en pasos de 0.5.** Que un producto por peso se pueda vender 1.5 lb
   (no solo enteros), incluyendo media libra sola (0.5).

## Estado actual (lo que ya existe)

- `store-settings.json` ya guarda `shifts: [{start,end}]` y `closedWeekdays`, y
  `storeService.ensureDefaults` los preserva al guardar. **Falta** endpoint + UI para editarlos.
- Venta por peso: el admin ya marca productos como `unit` / `weight` / `both`
  (`admin/products/page.js`); el modal y el carrito ya suben/bajan de 0.5 en 0.5
  (`ProductModal.js`, `CartDrawer.js`, `useCartStore.js`). Un cliente **ya puede** poner
  1.5 lb al carrito.
- **Bugs/gaps de la venta por peso:**
  - `Order.js` exige `quantity` mínimo **1** → un pedido de **0.5 lb solo falla** al confirmar.
  - El pedido **no guarda** `unitType`; el checkout no lo envía. La factura y el admin
    muestran `1.5x Pollo` en vez de `1.5 lb Pollo`.
  - El descuento de stock del backend ya soporta decimales, pero el admin guarda stock con
    `parseInt` (trunca decimales).

## Decisiones tomadas con el usuario

- **Alcance de horarios:** editar turno 1 / receso / turno 2, y poder quitar un turno.
  El receso es el hueco entre turnos (una sola fuente de verdad). **No** se editan los días
  de la semana en esta iteración.
- **Stock de productos por peso:** se lleva **en libras con decimales** (ej. quedan 8.5 lb);
  vender 1.5 lb descuenta 1.5 del stock.

---

## Feature A — Editor de horarios

### Modelo de datos
Sin cambios de estructura. Se sigue usando `store-settings.json`:
```json
{ "shifts": [ { "start": "10:30", "end": "15:00" }, { "start": "16:00", "end": "20:00" } ] }
```
El **receso** es el intervalo entre `shifts[i].end` y `shifts[i+1].start`. Si hay un solo
turno, no hay receso.

### Backend
- **`storeService.js` → `updateShifts(shifts)`** (nueva función, exportada):
  - Valida: array de 1 a 4 turnos; cada `start`/`end` con formato `HH:MM` (00:00–23:59);
    `start < end` dentro de cada turno; turnos ordenados y **sin solaparse**
    (`shift[i].end <= shift[i+1].start`).
  - Normaliza (ordena por hora de inicio) y persiste con `writeSettings`.
  - Lanza `Error` con mensaje claro si algo es inválido.
- **`storeService.js` → receso dinámico:** en `getStoreStatus`, reemplazar el hardcode
  `parts.minutesOfDay >= parseHm('15:00') && < parseHm('16:00')` por un cálculo del hueco
  real entre turnos (buscar el gap donde cae `minutesOfDay`). El mensaje "estamos en receso
  (X – Y)" usa las horas reales del hueco. Si no está en un hueco entre turnos, es
  "fuera de horario".
- **`storeController.js` → `setShifts(req,res)`:** recibe `{ shifts }`, llama `updateShifts`,
  responde `{ ...settings, status: getStoreStatus() }` como los otros endpoints admin.
- **`storeRoutes.js`:** `PUT /admin/shifts` con `authenticateAdmin`.

### Frontend
- **`lib/api.js` → `setStoreShifts(shifts)`:** `PUT /store/admin/shifts`.
- **`admin/store/page.js`:** nueva tarjeta **"Horarios de atención"**:
  - Estado local `shiftsDraft` inicializado desde `data.shifts`.
  - Por cada turno: dos `input type="time"` (inicio/fin) + botón "quitar" (si hay > 1 turno).
  - Entre turnos consecutivos, mostrar el receso calculado (solo lectura): "Receso: 3:00 – 4:00 pm".
  - Botón **"+ Agregar turno"** (máx 4) y botón **"Guardar horarios"** → `setStoreShifts`.
  - Validación en cliente antes de enviar (mismos criterios que el backend) con toast de error.
  - Reemplazar los textos fijos por el horario dinámico:
    - Mensaje de confirmación al habilitar domingo (línea ~174) → usar `status.hoursLabel`.
    - Footer "Horario fijo: 10:30 am–3:00 pm y 4:00 pm–8:00 pm" (línea ~657) → `status.hoursLabel`
      + `status.workDaysLabel`.
- El banner público (`StoreStatusBanner`, `ClosedWelcome`) ya consume `hoursLabel`/`shifts`
  desde `/api/store/status`, así que se actualiza solo tras guardar.

---

## Feature B — Venta por peso completa (0.5 en 0.5)

### Backend
- **`Order.js`:**
  - `orderItemSchema.quantity.min`: **1 → 0.5** (mensaje: "La cantidad mínima es 0.5").
  - Agregar `unitType: { type: String, enum: ['unit','weight'], default: 'unit' }` al
    `orderItemSchema`.
- **`orderController.js`:**
  - `createOrder`: leer `item.unitType` (default `'unit'`) y guardarlo en el item enriquecido.
    El chequeo y descuento de stock ya usan `item.quantity` y soportan decimales — sin cambios.
  - `updateOrderItems`: preservar `unitType` en los items reconstruidos.

### Frontend
- **`CheckoutForm.js`:** enviar `unitType: item.unitType` en cada item del `orderData`.
- **`invoiceText.js`:** en el detalle, si `item.unitType === 'weight'` mostrar
  `1.5 lb {producto}`; si no, `2x {producto}`.
- **`admin/orders/page.js`:** en el detalle del pedido (línea ~428 y donde se listan items)
  mostrar `lb` cuando el item es por peso. El editor de cantidad ya usa `step="0.5"`.
- **`admin/products/page.js`:** al guardar, si `sellBy` incluye peso, parsear stock con
  `parseFloat` (permitir decimales) y poner `step="0.5"` en el input de stock. Para productos
  solo por unidad se mantiene entero.
- **`admin/stock/page.js`:** permitir stock decimal (`parseFloat` en vez de `parseInt` en la
  línea ~61) y que el +/– rápido use paso 0.5 en productos por peso (paso 1 en unidad).
  Mostrar el valor con su decimal.

### Casos borde
- Producto marcado **`both`**: el stock es un único número; si se vende por unidad descuenta
  entero, por peso descuenta decimal. El dueño interpreta el número. (Documentado, sin lógica
  extra.)
- Pedido de **0.5 lb** ahora pasa la validación del modelo.
- Zona horaria sin cambios (`America/Guatemala`).

---

## Archivos que se tocan

**Backend**
- `backend/src/models/Order.js` — min 0.5 + `unitType`.
- `backend/src/controllers/orderController.js` — persistir `unitType`.
- `backend/src/services/storeService.js` — `updateShifts` + receso dinámico.
- `backend/src/controllers/storeController.js` — `setShifts`.
- `backend/src/routes/storeRoutes.js` — `PUT /admin/shifts`.

**Frontend**
- `frontend/src/lib/api.js` — `setStoreShifts`.
- `frontend/src/app/admin/store/page.js` — tarjeta de horarios + textos dinámicos.
- `frontend/src/lib/invoiceText.js` — "lb" en factura.
- `frontend/src/components/CheckoutForm.js` — enviar `unitType`.
- `frontend/src/app/admin/orders/page.js` — "lb" en detalle.
- `frontend/src/app/admin/products/page.js` — stock decimal para peso.
- `frontend/src/app/admin/stock/page.js` — stock decimal + paso 0.5.

## Plan de pruebas

- **Horarios:** cambiar turnos en el admin y confirmar que (a) el footer del admin y (b) el
  banner del cliente muestran el nuevo horario; probar validaciones (turnos solapados,
  inicio ≥ fin) y ver el mensaje de error; entrar en un horario de receso y ver el mensaje
  "estamos en receso (X–Y)" con las horas reales.
- **Por peso:** marcar un producto por peso con stock **10 lb**; pedir **1.5 lb** → factura
  dice "1.5 lb", stock queda en **8.5**; pedir **0.5 lb** solo → el pedido se confirma sin
  error; verificar que el admin de pedidos muestra "lb".

## Fuera de alcance (YAGNI)
- Editar qué días de la semana abre/cierra (el usuario eligió no incluirlo ahora).
- Horarios distintos por día.
- Cambiar el manejo del bot de WhatsApp (no se toca).
