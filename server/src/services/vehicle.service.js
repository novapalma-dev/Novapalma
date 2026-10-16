import { prisma } from '../config/db.js';
import * as auditService from './audit.service.js';

/**
 * Crea un nuevo vehículo con registro de auditoría.
 */
export const createVehicle = async (vehicleData, userId = null, auditMeta = {}) => {
  return await prisma.$transaction(async (tx) => {
    const existingVehicle = await tx.vehicle.findUnique({
      where: { placa: vehicleData.placa.toUpperCase() }
    });

    if (existingVehicle) {
      if (!existingVehicle.activo || existingVehicle.deletedAt !== null) {
        throw new Error('Ya existe un vehículo inactivo registrado con esta placa. Un administrador debe reactivarlo desde el panel de flota.');
      }
      throw new Error('Ya existe un vehículo registrado con esta placa');
    }

    const newVehicle = await tx.vehicle.create({
      data: {
        placa: vehicleData.placa.toUpperCase(),
        marca: vehicleData.marca,
        modelo: vehicleData.modelo,
        capacidad: vehicleData.capacidad,
        estado: vehicleData.estado || 'DISPONIBLE',
      }
    });

    await auditService.logAudit({
      userId,
      action: 'CREATE',
      entity: 'Vehicle',
      entityId: newVehicle.id,
      newValues: newVehicle,
      ipAddress: auditMeta.ipAddress,
      userAgent: auditMeta.userAgent
    }, tx);

    console.log(`🚚 Vehículo ${newVehicle.placa} creado exitosamente. 🛡️ Auditoría registrada.`);
    return newVehicle;
  });
};

/**
 * Obtiene todos los vehículos activos.
 */
export const getAllVehicles = async (includeDeleted = false) => {
  if (includeDeleted) {
    return await prisma.vehicle.findMany();
  }
  return await prisma.vehicle.findMany({
    where: { deletedAt: null, activo: true }
  });
};

/**
 * Obtiene un vehículo por ID.
 */
export const getVehicleById = async (id) => {
  return await prisma.vehicle.findUnique({
    where: { id, deletedAt: null, activo: true }
  });
};

/**
 * Actualiza un vehículo con registro de auditoría.
 */
export const updateVehicle = async (id, updateData, userId = null, auditMeta = {}) => {
  return await prisma.$transaction(async (tx) => {
    const [locked] = await tx.$queryRaw`SELECT id, activo, "deletedAt" FROM vehicles WHERE id = ${id}::uuid FOR UPDATE`;
    if (!locked) throw new Error('Vehículo no encontrado');

    const isCurrentlyInactive = !locked.activo || locked.deletedAt !== null;
    if (isCurrentlyInactive && updateData.activo !== true) {
      throw new Error('Vehículo inactivo o eliminado. Debe reactivarlo antes de modificar sus datos.');
    }

    const oldVehicle = await tx.vehicle.findUniqueOrThrow({ where: { id } });

    const dataToUpdate = { ...updateData };
    if (dataToUpdate.placa) {
      dataToUpdate.placa = dataToUpdate.placa.toUpperCase();
    }
    if (dataToUpdate.activo === true) {
      dataToUpdate.deletedAt = null;
    } else if (dataToUpdate.activo === false) {
      dataToUpdate.deletedAt = new Date();
    } else if (dataToUpdate.deletedAt === null) {
      dataToUpdate.activo = true;
    }

    const updatedVehicle = await tx.vehicle.update({
      where: { id },
      data: dataToUpdate
    });

    await auditService.logAudit({
      userId,
      action: 'UPDATE',
      entity: 'Vehicle',
      entityId: id,
      oldValues: oldVehicle,
      newValues: updatedVehicle,
      ipAddress: auditMeta.ipAddress,
      userAgent: auditMeta.userAgent
    }, tx);

    console.log(`✅ Vehículo ${updatedVehicle.placa} actualizado. 🛡️ Auditoría registrada.`);
    return updatedVehicle;
  });
};

/**
 * Realiza un Soft Delete del vehículo.
 */
export const deleteVehicle = async (id, userId = null, auditMeta = {}) => {
  return await prisma.$transaction(async (tx) => {
    const [locked] = await tx.$queryRaw`SELECT id FROM vehicles WHERE id = ${id}::uuid AND "deletedAt" IS NULL FOR UPDATE`;
    if (!locked) throw new Error('Vehículo no encontrado o ya ha sido eliminado');

    const oldVehicle = await tx.vehicle.findUniqueOrThrow({ where: { id } });

    const deletedVehicle = await tx.vehicle.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        activo: false
      }
    });

    await auditService.logAudit({
      userId,
      action: 'DELETE',
      entity: 'Vehicle',
      entityId: id,
      oldValues: oldVehicle,
      newValues: { deletedAt: deletedVehicle.deletedAt, activo: false },
      ipAddress: auditMeta.ipAddress,
      userAgent: auditMeta.userAgent
    }, tx);

    console.log(`🗑️ Soft Delete aplicado al vehículo ${oldVehicle.placa}. 🛡️ Auditoría registrada.`);
    return deletedVehicle;
  });
};
