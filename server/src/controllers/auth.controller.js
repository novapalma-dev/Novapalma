import * as authService from '../services/auth.service.js';
import * as userService from '../services/user.service.js';
import { formatError } from '../utils/errorHandler.js';

/**
 * ============================================================
 * CONTROLADOR DE AUTENTICACIÓN (AUTH CONTROLLER)
 * ============================================================
 * Capa de Seguridad y Orquestación de Sesión.
 * Implementa el control de acceso inicial y mitigación de vulnerabilidades OWASP.
 */

/**
 * @route   POST /api/auth/login
 * @desc    Autentica credenciales y emite cookies HttpOnly blindadas
 * @access  Público
 * @seguridad Implementa 'Zero Visibility' del token al JS del cliente e intercepta IP y User-Agent
 */
export const login = async (req, res) => {
  const { correo, password } = req.body;
  
  // Extracción robusta de IP pública real detrás de balanceadores y proxies (Cloudflare/Render/Vercel)
  // El primer elemento de la cabecera 'x-forwarded-for' siempre es la IP pública original del cliente.
  const ipAddress = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || req.socket.remoteAddress;
  
  const userAgent = req.get('User-Agent');

  try {
    const { user, token } = await authService.login(correo, password, ipAddress, userAgent);
    
    // Configuramos la cookie con flags de seguridad Enterprise-grade:
    // - httpOnly: Impide acceso desde document.cookie (Mitigación XSS)
    // - secure: Solo viaja por HTTPS (en producción)
    // - sameSite: Previene ataques CSRF (Cross-Site Request Forgery)
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 8 * 60 * 60 * 1000 // 8 Horas de vida en el cliente
    });

    // Retornamos solo la data del usuario, el token ya viaja blindado en la cookie
    res.json({ user });
  } catch (error) {
    console.warn(`⚠️ Intento de login fallido para: ${correo} desde IP: ${ipAddress}`);
    const { status, message } = formatError(error);
    // Conservamos status 401 para credenciales inválidas, de lo contrario usamos el status del formateador (ej. 503 si DB está caída)
    const finalStatus = error.message.includes('inválidas') || error.message.includes('encontrado') ? 401 : status;
    res.status(finalStatus).json({ error: message });
  }
};

/**
 * @route   POST /api/auth/logout
 * @desc    Cierra de sesión seguro y revoca sesión del cliente
 * @access  Privado (ADMIN, OPERADOR)
 * @seguridad Remueve físicamente la cookie de sesión del navegador para anular posteriores peticiones
 */
export const logout = async (req, res) => {
  const token = req.cookies.token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);
  const ipAddress = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || req.socket.remoteAddress;
  const userAgent = req.get('User-Agent');

  try {
    await authService.logout(token, ipAddress, userAgent);
  } catch (error) {
    console.error('Error durante la revocación del token en logout:', error);
  }

  res.clearCookie('token');
  res.json({ message: 'Sesión finalizada correctamente' });
};

/**
 * @route   PUT /api/auth/perfil
 * @desc    Permite a cualquier usuario autenticado actualizar su propio perfil y contraseña
 * @access  Privado (ADMIN, OPERADOR)
 */
export const updateProfile = async (req, res) => {
  try {
    // El usuario logueado req.user.id solo puede actualizar su propio perfil y contraseña
    const user = await userService.updateOwnProfile(req.user.id, req.body);
    res.json({ user });
  } catch (error) {
    const { status, message } = formatError(error);
    res.status(status).json({ error: message });
  }
};
