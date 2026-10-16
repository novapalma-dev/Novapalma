import * as driverService from '../services/driver.service.js';
import { formatError } from '../utils/errorHandler.js';

/**
 * ============================================================
 * CONTROLADOR DE CONDUCTORES (DRIVER CONTROLLER)
 * ============================================================
 * Capa de Orquestación HTTP para la gestión de flota humana.
 * Conecta los endpoints de conductores con el servicio correspondiente.
 */

/**
 * @route   POST /api/conductores
 * @desc    Registra un nuevo conductor o reactiva uno inactivo
 * @access  Privado (ADMIN, OPERADOR)
 * @trazabilidad Pasa req.user.id al servicio para registrar el actor en la auditoría inmutable
 */
export const create = async (req, res) => {
  try {
    const driver = await driverService.createDriver(req.body, req.user.id);
    res.status(201).json(driver);
  } catch (error) {
    const { status, message } = formatError(error);
    res.status(status).json({ error: message });
  }
};

/**
 * @route   GET /api/conductores
 * @desc    Lista todos los conductores activos de la flota
 * @access  Privado (ADMIN, OPERADOR)
 */
export const getAll = async (req, res) => {
  try {
    const includeDeleted = req.query.includeDeleted === 'true' && req.user?.rol === 'ADMIN';
    const drivers = await driverService.getAllDrivers(includeDeleted);
    res.json(drivers);
  } catch (error) {
    const { status, message } = formatError(error);
    res.status(status).json({ error: message });
  }
};

/**
 * @route   GET /api/conductores/:id
 * @desc    Obtiene el perfil y datos de contacto de un conductor específico
 * @access  Privado (ADMIN, OPERADOR)
 */
export const getById = async (req, res) => {
  try {
    const driver = await driverService.getDriverById(req.params.id);
    if (!driver) return res.status(404).json({ error: 'Conductor no encontrado' });
    res.json(driver);
  } catch (error) {
    const { status, message } = formatError(error);
    res.status(status).json({ error: message });
  }
};

/**
 * @route   PUT /api/conductores/:id
 * @desc    Modifica la información del conductor
 * @access  Privado (ADMIN, OPERADOR)
 * @trazabilidad Pasa req.user.id para registrar el snapshot del cambio de datos en la auditoría
 */
export const update = async (req, res) => {
  try {
    const driver = await driverService.updateDriver(req.params.id, req.body, req.user.id);
    res.json(driver);
  } catch (error) {
    const { status, message } = formatError(error);
    res.status(status).json({ error: message });
  }
};

/**
 * @route   DELETE /api/conductores/:id
 * @desc    Baja lógica (Soft Delete) del conductor de la flota activa
 * @access  Privado (ADMIN)
 * @trazabilidad Registra el Soft Delete en la bitácora vinculándolo al administrador actor
 */
export const remove = async (req, res) => {
  try {
    const driver = await driverService.deleteDriver(req.params.id, req.user.id);
    res.json({ message: 'Conductor eliminado (Soft Delete)', driver });
  } catch (error) {
    const { status, message } = formatError(error);
    res.status(status).json({ error: message });
  }
};

