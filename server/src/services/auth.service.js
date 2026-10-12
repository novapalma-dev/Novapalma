import { prisma } from '../config/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import * as auditService from './audit.service.js';

export const login = async (correo, password, ipAddress, userAgent) => {
  // 1. Buscar usuario
  const user = await prisma.user.findUnique({
    where: { correo, activo: true }
  });

  if (!user) {
    throw new Error('Credenciales inválidas o usuario inactivo');
  }

  // 2. Validar password
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new Error('Credenciales inválidas');
  }

  // 3. Generar JWT con algoritmo explícito y jwtid único para evitar colisiones de token
  const token = jwt.sign(
    { id: user.id, rol: user.rol },
    process.env.JWT_SECRET,
    { expiresIn: '8h', algorithm: 'HS256', jwtid: crypto.randomUUID() }
  );

  // 4. Almacenar sesión activa en refresh_tokens
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 8); // Expira en 8 horas, coherente con JWT

  await prisma.refreshToken.create({
    data: {
      token,
      userId: user.id,
      expiresAt
    }
  });

  // 5. Registrar auditoría de Login
  await auditService.logAudit({
    userId: user.id,
    action: 'LOGIN',
    entity: 'User',
    entityId: user.id,
    ipAddress,
    userAgent
  });

  console.log(`🔐 Usuario autenticado y sesión registrada: ${user.correo}`);

  return {
    token,
    user: {
      id: user.id,
      primerNombre: user.primerNombre,
      primerApellido: user.primerApellido,
      correo: user.correo,
      rol: user.rol
    }
  };
};

export const logout = async (token, ipAddress, userAgent) => {
  if (!token) return;

  let decoded;
  try {
    // Verificar firma con algoritmo explícito. Se ignora expiración para permitir
    // cerrar sesión y revocar tokens recién vencidos sin error.
    decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      ignoreExpiration: true
    });
  } catch (err) {
    // Si la firma es ilegítima o fue adulterada, se rechaza y no se genera registro de auditoría falso
    console.warn('⚠️ Intento de logout con token adulterado o firma inválida');
    return;
  }

  if (decoded && decoded.id) {
    // Ejecución atómica de revocación y bitácora en una misma transacción ACID
    await prisma.$transaction(async (tx) => {
      const updateResult = await tx.refreshToken.updateMany({
        where: { token, userId: decoded.id, revoked: false },
        data: { revoked: true }
      });

      // Solo registrar auditoría si existía un registro activo a revocar
      if (updateResult.count > 0) {
        await auditService.logAudit({
          userId: decoded.id,
          action: 'LOGOUT',
          entity: 'User',
          entityId: decoded.id,
          ipAddress,
          userAgent
        }, tx);

        console.log(`🛡️ Auditoría Forense: LOGOUT verificado para el usuario ${decoded.id}`);
      }
    });
  }
};
