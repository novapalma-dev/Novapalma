import { prisma } from '../config/db.js';
import bcrypt from 'bcryptjs';
import * as auditService from './audit.service.js';

/**
 * ============================================================================
 * SERVICIO DE USUARIOS Y CONTROL DE ACCESO (USER SERVICE)
 * ============================================================================
 * Proporciona el control CRUD y el aprovisionamiento seguro de cuentas.
 * Implementa blindaje de seguridad crítica en operaciones de administración
 * y persistencia transaccional ACID de auditoría forense.
 */

/**
 * Obtiene el listado de todos los usuarios registrados que no han sido
 * eliminados lógicamente (deletedAt = null).
 * Excluye los hashes de contraseña de los registros retornados para evitar
 * fugas accidentales de información.
 * 
 * @returns {Promise<Array>} Listado de usuarios con datos de perfil seleccionados.
 */
export const getAllUsers = async () => {
  return await prisma.user.findMany({
    // Filtrar para excluir usuarios con eliminación lógica
    where: { deletedAt: null },
    // Carga de campos segura: No se incluye el password hash en la selección
    select: {
      id: true,
      primerNombre: true,
      segundoNombre: true,
      primerApellido: true,
      segundoApellido: true,
      correo: true,
      rol: true,
      activo: true,
      createdAt: true,
      updatedAt: true
    }
  });
};

/**
 * Crea un nuevo usuario en la base de datos de forma transaccional.
 * Requiere que el creador de la cuenta sea un administrador activo del sistema.
 * Cifra la contraseña provista usando hashing bcrypt con 10 salt rounds.
 * 
 * @param {Object} userData - Datos de registro (nombre, correo, password, rol).
 * @param {string} creatorId - UUID del usuario que ejecuta la acción.
 * @returns {Promise<Object>} El usuario creado (sin el hash de contraseña).
 * @throws {Error} Si no se provee creatorId, si el creador no existe, si no es administrador o si falla el registro.
 */
export const createUser = async (userData, creatorId = null) => {
  // Regla de Trazabilidad: Se requiere identificar al actor creador obligatoriamente
  if (!creatorId) {
    throw new Error('Operación denegada: Se requiere la identificación del creador.');
  }

  // Regla de Autorización: Verificar que el creador sea un administrador activo en la base de datos
  const actor = await prisma.user.findFirst({
    where: { id: creatorId, activo: true, deletedAt: null }
  });
  if (!actor || actor.rol !== 'ADMIN') {
    throw new Error('Operación denegada: Se requieren privilegios de administrador activos para registrar nuevos usuarios.');
  }

  // Cifrado de contraseña asíncrono para asegurar las credenciales en reposo
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

  // Ejecución atómica ACID de la creación de usuario y registro de su auditoría correspondiente
  return await prisma.$transaction(async (tx) => {
    // 1. Insertar el registro de usuario en base de datos
    const newUser = await tx.user.create({
      data: {
        primerNombre: userData.primerNombre,
        segundoNombre: userData.segundoNombre,
        primerApellido: userData.primerApellido,
        segundoApellido: userData.segundoApellido,
        correo: userData.correo.trim().toLowerCase(),
        password: hashedPassword,
        rol: userData.rol || 'OPERADOR'
      }
    });

    // 2. Registrar el rastro forense inmutable de la creación de la cuenta
    await auditService.logAudit({
      userId: creatorId,
      action: 'CREATE',
      entity: 'User',
      entityId: newUser.id,
      newValues: {
        correo: newUser.correo,
        rol: newUser.rol,
        nombreCompleto: `${newUser.primerNombre} ${newUser.primerApellido}`
      }
    }, tx);

    console.log(`🛡️ Auditoría confirmada para el usuario: ${newUser.correo}`);

    // Limpieza de datos sensibles del objeto a retornar al llamador
    const { password, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  });
};

/**
 * Actualiza los datos de un usuario existente, incluyendo auditoría del cambio.
 * Aplica reglas estrictas de blindaje para impedir auto-bloqueos o degradación de roles.
 * 
 * @param {string} id - UUID del usuario a modificar.
 * @param {Object} updateData - Nuevos datos del usuario a aplicar.
 * @param {string} adminId - UUID del administrador que realiza la actualización.
 * @returns {Promise<Object>} Datos del usuario actualizado (sin password hash).
 * @throws {Error} Si el actor no es ADMIN, si se intenta el auto-bloqueo del administrador activo,
 *                 o si se intenta desactivar al único administrador activo disponible.
 */
export const updateUser = async (id, updateData, adminId) => {
  // Regla de Trazabilidad: Identificación del autor es mandatoria
  if (!adminId) {
    throw new Error('Operación denegada: Se requiere la identificación del administrador.');
  }

  // Regla de Autorización: Verificar que el actor ejecutor tenga privilegios de administrador
  const actor = await prisma.user.findFirst({
    where: { id: adminId, activo: true, deletedAt: null }
  });
  if (!actor || actor.rol !== 'ADMIN') {
    throw new Error('Operación denegada: Se requieren privilegios de administrador activos para modificar usuarios.');
  }

  // Blindaje de Seguridad Crítico: Prevenir que el administrador se auto-bloquee o se degrade a sí mismo
  if (id === adminId) {
    if (updateData.activo === false) {
      throw new Error('Operación denegada: No puedes desactivar o suspender tu propia cuenta de administrador.');
    }
    if (updateData.rol === 'OPERADOR') {
      throw new Error('Operación denegada: No puedes degradar tu propio rol de ADMINISTRADOR a OPERADOR.');
    }
  }

  const dataToUpdate = { ...updateData };
  if (dataToUpdate.correo) {
    dataToUpdate.correo = dataToUpdate.correo.trim().toLowerCase();
  }

  // Cifrar de forma asíncrona la contraseña si se está enviando una actualización de contraseña
  if (updateData.password) {
    const saltRounds = 10;
    dataToUpdate.password = await bcrypt.hash(updateData.password, saltRounds);
  }

  // Transacción ACID para asegurar consistencia del estado del sistema
  return await prisma.$transaction(async (tx) => {
    // Blindaje C4: Bloquear con FOR UPDATE las filas de administradores activos si la mutación
    // involucra desactivar o degradar roles, serializando comprobaciones de quórum de administradores.
    if (updateData.activo === false || updateData.rol === 'OPERADOR') {
      await tx.$queryRaw`SELECT id FROM users WHERE rol = 'ADMIN'::"Role" AND activo = true AND "deletedAt" IS NULL FOR UPDATE`;
    }

    // 1. Obtener datos previos del usuario a modificar con lock exclusivo para evitar lost updates
    const [lockedUser] = await tx.$queryRaw`SELECT id FROM users WHERE id = ${id}::uuid FOR UPDATE`;
    if (!lockedUser) throw new Error('Usuario no encontrado');

    const oldUser = await tx.user.findUniqueOrThrow({
      where: { id }
    });

    // Blindaje de resiliencia: Si el usuario objetivo es ADMIN y se le intenta desactivar
    // o degradar de rol, validar que exista al menos otro administrador activo para evitar
    // dejar al sistema sin accesos administrativos.
    if (oldUser.rol === 'ADMIN' && (updateData.activo === false || updateData.rol === 'OPERADOR')) {
      const activeAdminsCount = await tx.user.count({
        where: {
          rol: 'ADMIN',
          activo: true,
          deletedAt: null
        }
      });

      if (activeAdminsCount <= 1) {
        throw new Error('Operación denegada: No se puede desactivar o degradar al único administrador activo en el sistema.');
      }
    }

    // 2. Ejecutar la actualización en base de datos
    const updatedUser = await tx.user.update({
      where: { id },
      data: dataToUpdate
    });

    // Blindaje C3: Revocar sesiones activas si se desactiva, degrada rol o cambia contraseña
    if (updateData.activo === false || updateData.rol !== undefined || updateData.password) {
      await tx.refreshToken.updateMany({
        where: { userId: id, revoked: false },
        data: { revoked: true }
      });
    }

    // 3. Registrar auditoría forense capturando el delta de los cambios
    await auditService.logAudit({
      userId: adminId,
      action: 'UPDATE',
      entity: 'User',
      entityId: id,
      oldValues: {
        correo: oldUser.correo,
        rol: oldUser.rol,
        activo: oldUser.activo,
        nombreCompleto: `${oldUser.primerNombre} ${oldUser.primerApellido}`
      },
      newValues: {
        correo: updatedUser.correo,
        rol: updatedUser.rol,
        activo: updatedUser.activo,
        nombreCompleto: `${updatedUser.primerNombre} ${updatedUser.primerApellido}`
      }
    }, tx);

    console.log(`🛡️ Auditoría de actualización confirmada para el usuario: ${updatedUser.correo}`);

    // Remover hash sensible antes de retornar los datos
    const { password, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  });
};

/**
 * Actualiza los datos de perfil y contraseña del propio usuario autenticado (autoservicio).
 * Permite tanto a OPERADOR como a ADMIN modificar su nombre y contraseña sin requerir privilegios de admin.
 * Bloquea estrictamente la alteración de correo, rol, activo o deletedAt.
 *
 * @param {string} userId - UUID del usuario autenticado.
 * @param {Object} profileData - Campos validados de perfil (primerNombre, segundoNombre, etc., password).
 * @returns {Promise<Object>} Datos del usuario actualizado sin el hash de contraseña.
 */
export const updateOwnProfile = async (userId, profileData, currentToken = null) => {
  if (!userId) {
    throw new Error('Operación denegada: Sesión no válida.');
  }

  const allowedData = {};
  if (profileData.primerNombre !== undefined) allowedData.primerNombre = profileData.primerNombre;
  if (profileData.segundoNombre !== undefined) allowedData.segundoNombre = profileData.segundoNombre;
  if (profileData.primerApellido !== undefined) allowedData.primerApellido = profileData.primerApellido;
  if (profileData.segundoApellido !== undefined) allowedData.segundoApellido = profileData.segundoApellido;

  let passwordChanged = false;
  if (profileData.password) {
    if (!profileData.currentPassword) {
      throw new Error('Debe ingresar su contraseña actual para establecer una nueva contraseña.');
    }
    const saltRounds = 10;
    allowedData.password = await bcrypt.hash(profileData.password, saltRounds);
    passwordChanged = true;
  }

  return await prisma.$transaction(async (tx) => {
    const oldUser = await tx.user.findFirst({
      where: { id: userId, activo: true, deletedAt: null }
    });
    if (!oldUser) throw new Error('Usuario no encontrado o inactivo');

    if (passwordChanged) {
      const isCurrentValid = await bcrypt.compare(profileData.currentPassword, oldUser.password);
      if (!isCurrentValid) {
        throw new Error('La contraseña actual ingresada es incorrecta.');
      }
    }

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: allowedData
    });

    if (passwordChanged) {
      await tx.refreshToken.updateMany({
        where: {
          userId,
          revoked: false,
          ...(currentToken ? { NOT: { token: currentToken } } : {})
        },
        data: { revoked: true }
      });
    }

    await auditService.logAudit({
      userId,
      action: 'UPDATE',
      entity: 'User',
      entityId: userId,
      oldValues: {
        primerNombre: oldUser.primerNombre,
        primerApellido: oldUser.primerApellido,
        passwordChanged: false
      },
      newValues: {
        primerNombre: updatedUser.primerNombre,
        primerApellido: updatedUser.primerApellido,
        passwordChanged
      }
    }, tx);

    const { password, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  });
};
