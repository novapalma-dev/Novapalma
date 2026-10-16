import * as userService from '../services/user.service.js';
import { formatError } from '../utils/errorHandler.js';

/**
 * ============================================================
 * CONTROLADOR DE USUARIOS (USER CONTROLLER)
 * ============================================================
 * Capa de Orquestación HTTP para la gestión de usuarios/operadores.
 * Reservado exclusivamente para administradores autenticados.
 */

const getAuditMeta = (req) => ({
  ipAddress: req.ip || req.socket?.remoteAddress || null,
  userAgent: req.get('User-Agent') || null
});

/**
 * @route   GET /api/usuarios
 * @desc    Lista todos los usuarios (operadores y administradores) activos
 * @access  Privado (ADMIN)
 */
export const getUsers = async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    res.json(users);
  } catch (error) {
    const { status, message } = formatError(error);
    res.status(status).json({ error: message });
  }
};

/**
 * @route   POST /api/usuarios
 * @desc    Registra una nueva cuenta de operador o administrador en el sistema
 * @access  Privado (ADMIN)
 * @trazabilidad Requiere req.user.id para verificar que el creador sea un administrador activo y registrar auditoría
 */
export const createNewUser = async (req, res) => {
  try {
    const user = await userService.createUser(req.body, req.user.id, getAuditMeta(req));
    res.status(201).json(user);
  } catch (error) {
    const { status, message } = formatError(error);
    res.status(status).json({ error: message });
  }
};

/**
 * @route   PUT /api/usuarios/:id
 * @desc    Actualiza información, contraseñas o roles de un usuario
 * @access  Privado (ADMIN)
 * @trazabilidad Valida a través del servicio que no ocurran auto-bloqueos o degradación del último administrador activo
 */
export const updateUser = async (req, res) => {
  try {
    const user = await userService.updateUser(req.params.id, req.body, req.user.id, getAuditMeta(req));
    res.json(user);
  } catch (error) {
    const { status, message } = formatError(error);
    res.status(status).json({ error: message });
  }
};

