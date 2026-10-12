import { prisma } from '../config/db.js';
import * as auditService from './audit.service.js';

/**
 * ============================================================================
 * AUXILIARES Y HELPERS INTERNOS (No exportados, reducen complejidad McCabe)
 * ============================================================================
 */

/**
 * Valida de forma asíncrona que el vehículo con el ID proporcionado existe y se encuentra activo.
 * Lanza un error si el vehículo no es válido o está inactivo.
 * Esta extracción reduce la carga cognitiva y acoplamiento directo de createTrip.
 * 
 * @param {Object} tx - Instancia de transacción o cliente de Prisma.
 * @param {string} vehicleId - ID único del vehículo a validar.
 * @returns {Promise<Object>} Datos del vehículo validado desde la base de datos.
 * @throws {Error} Si el vehículo no existe o no está activo.
 */
const validateActiveVehicle = async (tx, vehicleId) => {
  const vehicle = await tx.vehicle.findUnique({
    where: { id: vehicleId }
  });
  
  // Garantizar que la consulta retornó un vehículo y que su campo de vigencia (activo) es verdadero.
  if (!vehicle || !vehicle.activo) {
    throw new Error('Vehículo no encontrado o inactivo');
  }
  
  return vehicle;
};

/**
 * Valida de forma asíncrona que el conductor con el ID proporcionado existe y se encuentra activo.
 * Lanza un error si el conductor no es válido o está inactivo.
 * Esta extracción reduce la complejidad y mejora la mantenibilidad de la lógica del flete.
 * 
 * @param {Object} tx - Instancia de transacción o cliente de Prisma.
 * @param {string} driverId - ID único del conductor a validar.
 * @returns {Promise<Object>} Datos del conductor validado desde la base de datos.
 * @throws {Error} Si el conductor no existe o no está activo.
 */
const validateActiveDriver = async (tx, driverId) => {
  const driver = await tx.driver.findUnique({
    where: { id: driverId }
  });
  
  // Garantizar que la consulta retornó un conductor y que su campo de vigencia (activo) es verdadero.
  if (!driver || !driver.activo) {
    throw new Error('Conductor no encontrado o inactivo');
  }
  
  return driver;
};

/**
 * Calcula de forma determinista y aislada el pago correspondiente al conductor basándose
 * en el valor total del flete de pago y el porcentaje estipulado.
 * Esta función pura encapsula la regla de negocio aritmética de la comisión.
 * 
 * @param {number} valorPago - Valor total del flete de pago (base de cálculo).
 * @param {number|null|undefined} porcentajeConductor - Porcentaje de ganancia del conductor.
 * @returns {Object} Un objeto que contiene el porcentaje final aplicado (pct) y el valor calculado del conductor (valorConductor).
 */
const calculateConductorPay = (valorPago, porcentajeConductor) => {
  // Si no se define el porcentaje del conductor, se establece un valor por defecto de 1.00% (según requerimiento de negocio)
  const pct = porcentajeConductor !== undefined && porcentajeConductor !== null 
    ? Number(porcentajeConductor) 
    : 1.00;
  
  // Fórmula de comisión: Pago al conductor es el flete por el porcentaje sobre 100
  const valorConductor = valorPago * (pct / 100);
  
  return { pct, valorConductor };
};

/**
 * Procesa y formatea los datos de actualización del viaje para asegurar consistencia
 * de tipos en base de datos. Modifica el objeto dataToUpdate mutando tipos requeridos.
 * 
 * @param {Object} dataToUpdate - Objeto con los datos que se actualizarán.
 */
const parseUpdateFields = (dataToUpdate) => {
  // Asegura formato de fecha si se provee una nueva fecha
  if (dataToUpdate.fecha) {
    dataToUpdate.fecha = new Date(dataToUpdate.fecha);
  }

  // Castings numéricos rigurosos para campos opcionales del request
  if (dataToUpdate.ticket !== undefined) {
    dataToUpdate.ticket = Number(dataToUpdate.ticket);
  }
  
  if (dataToUpdate.valorPago !== undefined && dataToUpdate.valorPago !== null) {
    dataToUpdate.valorPago = Number(dataToUpdate.valorPago);
  }
  
  if (dataToUpdate.porcentajeConductor !== undefined && dataToUpdate.porcentajeConductor !== null) {
    dataToUpdate.porcentajeConductor = Number(dataToUpdate.porcentajeConductor);
  }
  
  if (dataToUpdate.valorAcpm !== undefined && dataToUpdate.valorAcpm !== null) {
    dataToUpdate.valorAcpm = Number(dataToUpdate.valorAcpm);
  }
  
  if (dataToUpdate.valorFerry !== undefined && dataToUpdate.valorFerry !== null) {
    dataToUpdate.valorFerry = Number(dataToUpdate.valorFerry);
  }
};

/**
 * ============================================================================
 * SERVICIO CORE DE VIAJES (TRIP SERVICE)
 * ============================================================================
 */

/**
 * Crea un nuevo viaje con registro de auditoría.
 * Realiza las validaciones necesarias del vehículo y del conductor, calcula el pago al conductor,
 * inserta el viaje en la base de datos de manera atómica, y escribe en la bitácora de auditoría.
 * Todo el flujo se envuelve en una transacción ACID para evitar registros huérfanos.
 * 
 * @param {Object} tripData - Datos de entrada del viaje (placa, conductor, ticket, origen, destino, etc.).
 * @param {string} userId - ID del usuario que registra el viaje (para auditoría).
 * @returns {Promise<Object>} El viaje creado con sus relaciones.
 */
export const createTrip = async (tripData, userId) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Validar que el vehículo esté activo mediante helper encapsulado
    await validateActiveVehicle(tx, tripData.vehicleId);

    // 2. Validar que el conductor esté activo mediante helper encapsulado
    await validateActiveDriver(tx, tripData.driverId);

    // 3. Validar y asignar valor del flete (obligatorio)
    if (tripData.valorPago === undefined || tripData.valorPago === null) {
      throw new Error('El valor del flete es obligatorio');
    }
    const valorPago = Number(tripData.valorPago);

    // 4. Calcular el pago al conductor (porcentaje del flete) usando helper aislado
    const { pct, valorConductor } = calculateConductorPay(valorPago, tripData.porcentajeConductor);

    // 5. Crear el registro del viaje en la base de datos
    const newTrip = await tx.trip.create({
      data: {
        ticket: Number(tripData.ticket),
        fecha: new Date(tripData.fecha),
        origen: tripData.origen,
        destino: tripData.destino || null,
        empresa: tripData.empresa || null,
        producto: tripData.producto,
        tonelaje: tripData.tonelaje,
        valorPago: valorPago,
        consumoAcpm: tripData.consumoAcpm,
        usoAcpm: tripData.usoAcpm || false,
        usoFerry: tripData.usoFerry || false,
        porcentajeConductor: pct,
        valorConductor: valorConductor,
        valorAcpm: tripData.valorAcpm !== undefined && tripData.valorAcpm !== null ? Number(tripData.valorAcpm) : 0.00,
        valorFerry: tripData.valorFerry !== undefined && tripData.valorFerry !== null ? Number(tripData.valorFerry) : 0.00,
        driverId: tripData.driverId,
        vehicleId: tripData.vehicleId,
        registradoPorId: userId
      },
      include: {
        driver: true,
        vehicle: true
      }
    });

    // 6. Registrar Auditoría del viaje creado
    await auditService.logAudit({
      userId,
      action: 'CREATE',
      entity: 'Trip',
      entityId: newTrip.id,
      newValues: newTrip
    }, tx);

    console.log(`🎫 Viaje registrado: Ticket ${newTrip.ticket}. 🛡️ Auditoría registrada.`);
    return newTrip;
  });
};

/**
 * Obtiene todos los viajes activos (no eliminados lógicamente).
 * Carga también la relación del conductor, vehículo y usuario que registró el viaje.
 * 
 * @returns {Promise<Array>} Listado de viajes ordenados por fecha de forma descendente.
 */
export const getAllTrips = async () => {
  return await prisma.trip.findMany({
    // Filtrar para excluir cualquier registro con eliminación lógica (Soft Delete)
    where: { deletedAt: null },
    include: {
      driver: {
        // Carga selectiva de datos legibles del conductor
        select: { primerNombre: true, primerApellido: true, cedula: true }
      },
      vehicle: {
        // Carga selectiva de datos del vehículo
        select: { placa: true, marca: true }
      },
      registradoPor: {
        // Carga selectiva de datos del operador/administrador
        select: { primerNombre: true, primerApellido: true }
      }
    },
    // Mostrar siempre los viajes más recientes primero
    orderBy: { fecha: 'desc' }
  });
};

/**
 * Obtiene el detalle técnico y relacional de un viaje específico mediante su ID único.
 * 
 * @param {string} id - UUID identificador único del viaje.
 * @returns {Promise<Object|null>} Registro del viaje con conductor, vehículo y usuario registrado, o null si no se encuentra.
 */
export const getTripById = async (id) => {
  return await prisma.trip.findUnique({
    where: { id, deletedAt: null },
    include: {
      driver: true,
      vehicle: true,
      registradoPor: true
    }
  });
};

/**
 * Actualiza un viaje existente de forma atómica y audita el cambio.
 * Recalcula de forma automática la comisión del conductor si cambian el porcentaje o el flete.
 * Todo el proceso se ejecuta dentro de una transacción ACID.
 * 
 * @param {string} id - UUID del viaje a actualizar.
 * @param {Object} updateData - Nuevos valores a actualizar.
 * @param {string} userId - UUID del usuario que realiza la modificación.
 * @returns {Promise<Object>} El objeto viaje actualizado.
 * @throws {Error} Si el viaje no se encuentra o ya está borrado.
 */
export const updateTrip = async (id, updateData, userId) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Bloqueo exclusivo de fila (FOR UPDATE) para prevenir lost updates y condiciones de carrera concurrentes
    const [locked] = await tx.$queryRaw`SELECT id FROM trips WHERE id = ${id}::uuid AND "deletedAt" IS NULL FOR UPDATE`;
    if (!locked) throw new Error('Viaje no encontrado o ya ha sido eliminado');

    const oldTrip = await tx.trip.findUniqueOrThrow({ 
      where: { id } 
    });

    // Clonar los datos recibidos y adjuntar el ID de auditoría del usuario que muta el recurso
    const dataToUpdate = { ...updateData };
    dataToUpdate.actualizadoPorId = userId;
    
    // 2. Parsear y homogeneizar los tipos de datos de actualización
    parseUpdateFields(dataToUpdate);

    // 3. Recalcular el valor del conductor dinámicamente basado en los cambios
    const finalValorPago = dataToUpdate.valorPago !== undefined ? dataToUpdate.valorPago : Number(oldTrip.valorPago);
    const finalPorcentaje = dataToUpdate.porcentajeConductor !== undefined 
      ? dataToUpdate.porcentajeConductor 
      : oldTrip.porcentajeConductor;
    
    const { valorConductor } = calculateConductorPay(finalValorPago, finalPorcentaje);
    dataToUpdate.valorConductor = valorConductor;

    // 4. Ejecutar la actualización en la base de datos
    const updatedTrip = await tx.trip.update({
      where: { id },
      data: dataToUpdate,
      include: { driver: true, vehicle: true }
    });

    // 5. Registrar la Auditoría correspondiente incluyendo el snapshot de oldValues y newValues
    await auditService.logAudit({
      userId,
      action: 'UPDATE',
      entity: 'Trip',
      entityId: id,
      oldValues: oldTrip,
      newValues: updatedTrip
    }, tx);

    console.log(`✅ Viaje ${updatedTrip.ticket} actualizado exitosamente.`);
    return updatedTrip;
  });
};

/**
 * Realiza un Soft Delete (eliminación lógica) del viaje en la base de datos
 * y registra la acción en el historial de auditoría de forma atómica.
 * 
 * @param {string} id - UUID del viaje a dar de baja.
 * @param {string} userId - UUID del usuario que ordena la baja del flete.
 * @returns {Promise<Object>} Registro del viaje con la marca temporal en deletedAt.
 */
export const deleteTrip = async (id, userId) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Bloqueo exclusivo de fila (FOR UPDATE) asegurando que el viaje exista y no haya sido eliminado previamente
    const [locked] = await tx.$queryRaw`SELECT id FROM trips WHERE id = ${id}::uuid AND "deletedAt" IS NULL FOR UPDATE`;
    if (!locked) throw new Error('Viaje no encontrado o ya ha sido eliminado');

    const oldTrip = await tx.trip.findUniqueOrThrow({ where: { id } });

    // 2. Aplicar actualización para setear la marca de borrado y auditoría del autor
    const deletedTrip = await tx.trip.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        actualizadoPorId: userId
      }
    });

    // 3. Registrar auditoría forense para mantener la trazabilidad inalterable de la baja
    await auditService.logAudit({
      userId,
      action: 'DELETE',
      entity: 'Trip',
      entityId: id,
      oldValues: oldTrip,
      newValues: { deletedAt: deletedTrip.deletedAt }
    }, tx);

    console.log(`🗑️ Viaje ${oldTrip.ticket} eliminado.`);
    return deletedTrip;
  });
};
