import { prisma } from '../config/db.js';
import * as auditService from './audit.service.js';

/**
 * Crea un nuevo conductor con registro de auditoría.
 */
export const createDriver = async (driverData, userId = null) => {
  return await prisma.$transaction(async (tx) => {
    // Verificar si ya existe un conductor con esa cédula
    const existingDriver = await tx.driver.findUnique({
      where: { cedula: driverData.cedula }
    });

    if (existingDriver) {
      if (!existingDriver.activo || existingDriver.deletedAt !== null) {
        throw new Error('Ya existe un conductor inactivo registrado con esta cédula. Un administrador debe reactivarlo desde el panel de conductores.');
      }
      throw new Error('Ya existe un conductor registrado con esta cédula');
    }

    const newDriver = await tx.driver.create({
      data: {
        cedula: driverData.cedula,
        primerNombre: driverData.primerNombre,
        segundoNombre: driverData.segundoNombre,
        primerApellido: driverData.primerApellido,
        segundoApellido: driverData.segundoApellido,
        telefono: driverData.telefono,
      }
    });

    await auditService.logAudit({
      userId,
      action: 'CREATE',
      entity: 'Driver',
      entityId: newDriver.id,
      newValues: newDriver
    }, tx);

    console.log(`👨‍✈️ Conductor ${newDriver.primerNombre} ${newDriver.primerApellido} creado. 🛡️ Auditoría registrada.`);
    return newDriver;
  });
};

/**
 * Obtiene todos los conductores activos.
 */
export const getAllDrivers = async (includeDeleted = false) => {
  if (includeDeleted) {
    return await prisma.driver.findMany();
  }
  return await prisma.driver.findMany({
    where: { deletedAt: null, activo: true }
  });
};

/**
 * Obtiene un conductor por ID.
 */
export const getDriverById = async (id) => {
  return await prisma.driver.findUnique({
    where: { id, deletedAt: null, activo: true }
  });
};

/**
 * Actualiza un conductor con registro de auditoría.
 */
export const updateDriver = async (id, updateData, userId = null) => {
  return await prisma.$transaction(async (tx) => {
    const [locked] = await tx.$queryRaw`SELECT id, activo, "deletedAt" FROM drivers WHERE id = ${id}::uuid FOR UPDATE`;
    if (!locked) throw new Error('Conductor no encontrado');

    const isCurrentlyInactive = !locked.activo || locked.deletedAt !== null;
    if (isCurrentlyInactive && updateData.activo !== true) {
      throw new Error('Conductor inactivo o eliminado. Debe reactivarlo antes de modificar sus datos.');
    }

    const oldDriver = await tx.driver.findUniqueOrThrow({ where: { id } });

    const dataToUpdate = { ...updateData };
    if (dataToUpdate.activo === true) {
      dataToUpdate.deletedAt = null;
    } else if (dataToUpdate.activo === false) {
      dataToUpdate.deletedAt = new Date();
    } else if (dataToUpdate.deletedAt === null) {
      dataToUpdate.activo = true;
    }

    const updatedDriver = await tx.driver.update({
      where: { id },
      data: dataToUpdate
    });

    await auditService.logAudit({
      userId,
      action: 'UPDATE',
      entity: 'Driver',
      entityId: id,
      oldValues: oldDriver,
      newValues: updatedDriver
    }, tx);

    console.log(`✅ Conductor ${updatedDriver.primerNombre} actualizado. 🛡️ Auditoría registrada.`);
    return updatedDriver;
  });
};

/**
 * Realiza un Soft Delete del conductor.
 */
export const deleteDriver = async (id, userId = null) => {
  return await prisma.$transaction(async (tx) => {
    const [locked] = await tx.$queryRaw`SELECT id FROM drivers WHERE id = ${id}::uuid AND "deletedAt" IS NULL FOR UPDATE`;
    if (!locked) throw new Error('Conductor no encontrado o ya ha sido eliminado');

    const oldDriver = await tx.driver.findUniqueOrThrow({ where: { id } });

    const deletedDriver = await tx.driver.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        activo: false
      }
    });

    await auditService.logAudit({
      userId,
      action: 'DELETE',
      entity: 'Driver',
      entityId: id,
      oldValues: oldDriver,
      newValues: { deletedAt: deletedDriver.deletedAt, activo: false }
    }, tx);

    console.log(`🗑️ Soft Delete aplicado al conductor ${oldDriver.cedula}. 🛡️ Auditoría registrada.`);
    return deletedDriver;
  });
};
