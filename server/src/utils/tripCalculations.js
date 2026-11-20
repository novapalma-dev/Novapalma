/**
 * ============================================================================
 * UTILIDADES PURAS DE CÁLCULO Y NORMALIZACIÓN DE VIAJES (Design for Testability)
 * ============================================================================
 * Extraídas de trip.service.js para permitir pruebas unitarias deterministas
 * en milisegundos sin acoplamiento a Prisma ni a PostgreSQL.
 */

/**
 * Calcula de forma determinista el pago correspondiente al conductor basándose
 * en el valor total del flete de pago y el porcentaje estipulado.
 *
 * @param {number} valorPago - Valor total del flete de pago (base de cálculo).
 * @param {number|null|undefined} porcentajeConductor - Porcentaje de ganancia del conductor (0–100).
 * @returns {{ pct: number, valorConductor: number }}
 */
export const calculateConductorPay = (valorPago, porcentajeConductor) => {
  // Si no se define el porcentaje del conductor, se establece 1.00% por defecto (regla de negocio)
  const pct =
    porcentajeConductor !== undefined && porcentajeConductor !== null
      ? Number(porcentajeConductor)
      : 1.0;

  if (Number.isNaN(pct) || pct < 0 || pct > 100) {
    throw new Error('El porcentaje del conductor debe estar entre 0% y 100%');
  }

  // Redondeo a 2 decimales para evitar residuos IEEE 754
  const valorConductor = Math.round(valorPago * (pct / 100) * 100) / 100;

  return { pct, valorConductor };
};

/**
 * Normaliza la coherencia entre los flags usoAcpm / usoFerry y sus importes (BL-07).
 * Si usoAcpm es false, consumoAcpm y valorAcpm se fuerzan a 0.
 * Si usoFerry es false, valorFerry se fuerza a 0.
 *
 * @param {Object} tripData
 * @returns {{ usoAcpm: boolean, usoFerry: boolean, consumoAcpm: number, valorAcpm: number, valorFerry: number }}
 */
export const normalizeTripCosts = (tripData) => {
  const usoAcpm = Boolean(tripData.usoAcpm);
  const usoFerry = Boolean(tripData.usoFerry);

  const consumoAcpm =
    usoAcpm && tripData.consumoAcpm !== undefined && tripData.consumoAcpm !== null
      ? Number(tripData.consumoAcpm)
      : 0;

  const valorAcpm =
    usoAcpm && tripData.valorAcpm !== undefined && tripData.valorAcpm !== null
      ? Number(tripData.valorAcpm)
      : 0.0;

  const valorFerry =
    usoFerry && tripData.valorFerry !== undefined && tripData.valorFerry !== null
      ? Number(tripData.valorFerry)
      : 0.0;

  return { usoAcpm, usoFerry, consumoAcpm, valorAcpm, valorFerry };
};

/**
 * Procesa y formatea los datos de actualización del viaje para asegurar consistencia
 * de tipos en base de datos. Modifica el objeto dataToUpdate en sitio.
 *
 * @param {Object} dataToUpdate
 */
export const parseUpdateFields = (dataToUpdate) => {
  if (dataToUpdate.fecha) {
    dataToUpdate.fecha = new Date(dataToUpdate.fecha);
  }

  if (dataToUpdate.ticket !== undefined) {
    dataToUpdate.ticket = Number(dataToUpdate.ticket);
  }

  if (dataToUpdate.valorPago !== undefined && dataToUpdate.valorPago !== null) {
    dataToUpdate.valorPago = Number(dataToUpdate.valorPago);
  }

  if (dataToUpdate.porcentajeConductor !== undefined && dataToUpdate.porcentajeConductor !== null) {
    dataToUpdate.porcentajeConductor = Number(dataToUpdate.porcentajeConductor);
  }

  if (dataToUpdate.consumoAcpm !== undefined && dataToUpdate.consumoAcpm !== null) {
    dataToUpdate.consumoAcpm = Number(dataToUpdate.consumoAcpm);
  }

  if (dataToUpdate.valorAcpm !== undefined && dataToUpdate.valorAcpm !== null) {
    dataToUpdate.valorAcpm = Number(dataToUpdate.valorAcpm);
  }

  if (dataToUpdate.valorFerry !== undefined && dataToUpdate.valorFerry !== null) {
    dataToUpdate.valorFerry = Number(dataToUpdate.valorFerry);
  }
};

/**
 * Construye los parámetros acotados de paginación y la cláusula WHERE de búsqueda.
 *
 * @param {{ page?: number|string, limit?: number|string, search?: string }} options
 * @returns {{ pageNum: number, limitNum: number, skip: number, where: Object }}
 */
export const buildTripsPaginationQuery = ({ page = 1, limit = 15, search = '' } = {}) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 15));
  const skip = (pageNum - 1) * limitNum;

  const where = { deletedAt: null };

  if (search && typeof search === 'string' && search.trim() !== '') {
    const s = search.trim();
    const ticketNum = parseInt(s, 10);
    const orConditions = [
      { origen: { contains: s, mode: 'insensitive' } },
      { destino: { contains: s, mode: 'insensitive' } },
      { empresa: { contains: s, mode: 'insensitive' } },
      { driver: { primerNombre: { contains: s, mode: 'insensitive' } } },
      { driver: { primerApellido: { contains: s, mode: 'insensitive' } } },
      { vehicle: { placa: { contains: s, mode: 'insensitive' } } }
    ];

    if (!Number.isNaN(ticketNum)) {
      orConditions.push({ ticket: ticketNum });
    }

    where.OR = orConditions;
  }

  return { pageNum, limitNum, skip, where };
};
