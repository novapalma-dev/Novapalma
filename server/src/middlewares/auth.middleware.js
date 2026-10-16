import jwt from 'jsonwebtoken';
import { prisma } from '../config/db.js';

/**
 * Middleware de Autenticación Centralizado.
 * Como DevOps Senior, hemos migrado de 'Authorization Bearer' a 'HttpOnly Cookies'.
 * Este cambio blinda el sistema contra ataques de robo de sesión (XSS).
 * Además, verifica que la sesión esté activa y no haya sido revocada en base de datos.
 */
export const authMiddleware = async (req, res, next) => {
  // Intentamos extraer el token de la cookie blindada, 
  // manteniendo compatibilidad con headers para herramientas de testing (Postman/Insomnia)
  const token = req.cookies.token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);

  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado. Sesión no válida o expirada.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    
    // Verificar estado de sesión activa y usuario en base de datos
    const session = await prisma.refreshToken.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            rol: true,
            activo: true,
            deletedAt: true
          }
        }
      }
    });

    if (
      !session ||
      session.revoked ||
      session.expiresAt < new Date() ||
      !session.user ||
      !session.user.activo ||
      session.user.deletedAt !== null
    ) {
      res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
      });
      return res.status(401).json({ error: 'Acceso denegado. La sesión ha sido cerrada, revocada o la cuenta no está activa.' });
    }
    
    // Inyectamos el usuario con su rol FRESCO de la base de datos (mitigando retención indebida de privilegios)
    req.user = {
      id: session.user.id,
      rol: session.user.rol
    };
    
    next();
  } catch (error) {
    // Si el token es inválido, limpiamos la cookie para evitar loops de error en el cliente
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    });
    return res.status(401).json({ error: 'Token inválido o sesión caducada.' });
  }
};
