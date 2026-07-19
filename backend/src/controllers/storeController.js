const {
  getStoreStatus,
  readSettings,
  setForceClosed,
  addRestDay,
  removeRestDay,
  toggleRestDay,
  getDayPlan,
  updateMinOrder,
  updateShifts,
} = require('../services/storeService');
const { getDeliveryZonesPayload } = require('../data/deliveryZones');

/** Público: estado de apertura + horarios + mínimo + zonas */
exports.getPublicStatus = (_req, res) => {
  try {
    const status = getStoreStatus();
    const delivery = getDeliveryZonesPayload();
    return res.json({
      success: true,
      data: {
        open: status.open,
        reason: status.reason,
        message: status.message,
        closedGreeting: status.closedGreeting,
        nextOpenHint: status.nextOpenHint,
        minOrder: status.minOrder,
        hoursLabel: status.hoursLabel,
        workDaysLabel: status.workDaysLabel,
        shifts: status.shifts,
        localTime: status.localTime,
        today: status.today,
        weekdayName: status.weekdayName,
        forceClosed: status.forceClosed,
        delivery,
      },
    });
  } catch (error) {
    console.error('Error store status:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener estado de la tienda' });
  }
};

/** Público: solo zonas de entrega */
exports.getZones = (_req, res) => {
  try {
    return res.json({ success: true, data: getDeliveryZonesPayload() });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error al obtener zonas' });
  }
};

/** Admin: settings completos */
exports.getAdminSettings = (_req, res) => {
  try {
    const settings = readSettings();
    const status = getStoreStatus();
    return res.json({
      success: true,
      data: { ...settings, status },
    });
  } catch (error) {
    console.error('Error admin store settings:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener configuración' });
  }
};

/** Admin: cerrar / abrir tienda de emergencia */
exports.setClosed = (req, res) => {
  try {
    const { closed, reason } = req.body || {};
    const settings = setForceClosed(Boolean(closed), reason || '');
    const status = getStoreStatus();
    return res.json({
      success: true,
      data: { ...settings, status },
      message: closed ? 'Tienda cerrada (no se aceptan pedidos)' : 'Tienda reabierta según horario',
    });
  } catch (error) {
    console.error('Error setClosed:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar cierre' });
  }
};

/** Admin: agregar descanso planificado */
exports.addRest = (req, res) => {
  try {
    const { date, reason } = req.body || {};
    if (!date) {
      return res.status(400).json({ success: false, message: 'La fecha es obligatoria' });
    }
    const settings = addRestDay(date, reason || '');
    const status = getStoreStatus();
    return res.json({
      success: true,
      data: { ...settings, status },
      message: 'Descanso planificado guardado',
    });
  } catch (error) {
    console.error('Error addRest:', error);
    return res.status(400).json({ success: false, message: error.message || 'Error al agregar descanso' });
  }
};

/** Admin: quitar descanso */
exports.removeRest = (req, res) => {
  try {
    const { id } = req.params;
    const settings = removeRestDay(id);
    const status = getStoreStatus();
    return res.json({
      success: true,
      data: { ...settings, status },
      message: 'Descanso eliminado',
    });
  } catch (error) {
    console.error('Error removeRest:', error);
    return res.status(500).json({ success: false, message: 'Error al eliminar descanso' });
  }
};

/** Admin: actualizar pedido mínimo */
exports.setMinOrder = (req, res) => {
  try {
    const { minOrder } = req.body || {};
    const settings = updateMinOrder(minOrder);
    return res.json({
      success: true,
      data: settings,
      message: `Pedido mínimo actualizado a Q ${settings.minOrder}`,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Error' });
  }
};

/** Admin: guardar horarios de atención (turnos) */
exports.setShifts = (req, res) => {
  try {
    const { shifts } = req.body || {};
    if (!Array.isArray(shifts)) {
      return res.status(400).json({ success: false, message: 'Enviá un array de turnos' });
    }
    const settings = updateShifts(shifts);
    const status = getStoreStatus();
    return res.json({
      success: true,
      data: { ...settings, status },
      message: 'Horarios guardados',
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Error al guardar horarios' });
  }
};

/** Admin: alternar cierre de un día (calendario) */
exports.toggleDay = (req, res) => {
  try {
    const { date, reason } = req.body || {};
    if (!date) {
      return res.status(400).json({ success: false, message: 'La fecha es obligatoria' });
    }
    const result = toggleRestDay(date, reason || '');
    const plan = getDayPlan(date);
    const msgs = {
      removed_rest: `Abierto el ${date} (se quitó el descanso)`,
      opened_special: `Domingo/día especial HABILITADO el ${date}`,
      closed_special: `Se deshabilitó la apertura especial del ${date}`,
      added_rest: `Cerrado el ${date} (descanso planificado)`,
    };
    return res.json({
      success: true,
      data: {
        ...result.settings,
        status: getStoreStatus(),
        dayPlan: plan,
        closed: result.closed,
        action: result.action,
      },
      message: msgs[result.action] || 'Día actualizado',
    });
  } catch (error) {
    console.error('Error toggleDay:', error);
    return res.status(400).json({ success: false, message: error.message || 'Error' });
  }
};

/** Admin: plan de un día + metadata */
exports.getDay = (req, res) => {
  try {
    const { date } = req.params;
    if (!date) {
      return res.status(400).json({ success: false, message: 'Fecha requerida' });
    }
    const plan = getDayPlan(date);
    return res.json({ success: true, data: plan });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Error' });
  }
};
