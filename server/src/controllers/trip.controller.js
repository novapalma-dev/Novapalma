import * as tripService from '../services/trip.service.js';
import { formatError } from '../utils/errorHandler.js';

/**
 * ============================================================
 * CONTROLADOR DE VIAJES (TRIP CONTROLLER)
 * ============================================================
 * Capa de Orquestación HTTP. Extrae los parámetros de la petición
 * y delega la ejecución transaccional a la capa de servicios.
 * Mantiene el principio de responsabilidad única (Single Responsibility Principle).
 */

const getAuditMeta = (req) => ({
  ipAddress: req.ip || req.socket?.remoteAddress || null,
  userAgent: req.get('User-Agent') || null
});

/**
 * @route   POST /api/viajes
 * @desc    Registra un nuevo flete de forma atómica en el sistema
 * @access  Privado (ADMIN, OPERADOR)
 * @trazabilidad Requiere ID del despachador autenticado inyectado por el middleware de autenticación
 */
export const create = async (req, res) => {
  try {
    // Se delega al servicio pasando el body y el ID del usuario actual (req.user.id)
    // para cumplir con la trazabilidad inmutable del registro de auditoría (registradoPorId)
    const trip = await tripService.createTrip(req.body, req.user.id, getAuditMeta(req));
    res.status(201).json(trip);
  } catch (error) {
    const { status, message } = formatError(error);
    res.status(status).json({ error: message });
  }
};

/**
 * @route   GET /api/viajes
 * @desc    Obtiene el historial completo de viajes que no han sido borrados lógicamente
 * @access  Privado (ADMIN, OPERADOR)
 */
export const getAll = async (req, res) => {
  try {
    const trips = await tripService.getAllTrips();
    res.json(trips);
  } catch (error) {
    const { status, message } = formatError(error);
    res.status(status).json({ error: message });
  }
};

/**
 * @route   GET /api/viajes/:id
 * @desc    Obtiene el detalle técnico de un viaje específico
 * @access  Privado (ADMIN, OPERADOR)
 */
export const getById = async (req, res) => {
  try {
    const trip = await tripService.getTripById(req.params.id);
    if (!trip) return res.status(404).json({ error: 'Viaje no encontrado' });
    res.json(trip);
  } catch (error) {
    const { status, message } = formatError(error);
    res.status(status).json({ error: message });
  }
};

/**
 * @route   PUT /api/viajes/:id
 * @desc    Actualiza un flete existente y recalcula los valores del flete
 * @access  Privado (ADMIN)
 * @trazabilidad Pasa el ID del usuario editor para loguear quién modificó el viaje (actualizadoPorId)
 */
export const update = async (req, res) => {
  try {
    const trip = await tripService.updateTrip(req.params.id, req.body, req.user.id, getAuditMeta(req));
    res.json(trip);
  } catch (error) {
    const { status, message } = formatError(error);
    res.status(status).json({ error: message });
  }
};

/**
 * @route   DELETE /api/viajes/:id
 * @desc    Realiza una baja lógica (Soft Delete) del viaje y libera el vehículo
 * @access  Privado (ADMIN)
 * @trazabilidad Loguea la acción de eliminación marcando el deletedAt con el usuario actor
 */
export const remove = async (req, res) => {
  try {
    const trip = await tripService.deleteTrip(req.params.id, req.user.id, getAuditMeta(req));
    res.json({ message: 'Viaje eliminado y vehículo liberado', trip });
  } catch (error) {
    const { status, message } = formatError(error);
    res.status(status).json({ error: message });
  }
};

