/**
 * ============================================================================
 * UTILIDADES PURAS DE REPORTES FINANCIEROS (Design for Testability)
 * ============================================================================
 * Extraídas de finance.routes.js para validar filtros de fechas y agregados
 * contables en aislamiento completo sin depender de Express ni PostgreSQL.
 */

const round2 = (n) => Math.round(n * 100) / 100;
const round3 = (n) => Math.round(n * 1000) / 1000;

/**
 * Construye la cláusula WHERE de Prisma para el filtro de fechas del reporte financiero (BL-13).
 *
 * @param {string|undefined} startDate
 * @param {string|undefined} endDate
 * @returns {{ whereClause?: Object, error?: string }}
 */
export const buildFinanceDateFilter = (startDate, endDate) => {
  const whereClause = { deletedAt: null };

  if (startDate || endDate) {
    whereClause.fecha = {};

    if (startDate) {
      const parsedStart = new Date(startDate);
      if (Number.isNaN(parsedStart.getTime())) {
        return { error: 'La fecha inicial no tiene un formato válido' };
      }
      whereClause.fecha.gte = parsedStart;
    }

    if (endDate) {
      const parsedEnd = new Date(endDate + 'T23:59:59.999Z');
      if (Number.isNaN(parsedEnd.getTime())) {
        return { error: 'La fecha final no tiene un formato válido' };
      }
      whereClause.fecha.lte = parsedEnd;
    }

    if (
      whereClause.fecha.gte &&
      whereClause.fecha.lte &&
      whereClause.fecha.gte > whereClause.fecha.lte
    ) {
      return { error: 'La fecha inicial no puede ser posterior a la fecha final' };
    }
  }

  return { whereClause };
};

/**
 * Consolida las métricas financieras a partir de un arreglo de viajes.
 * Respeta estrictamente los flags usoAcpm y usoFerry (BL-07) y aplica redondeo
 * aritmético a 2 decimales (COP) y 3 decimales (toneladas/galones) (BL-13).
 *
 * @param {Array<Object>} trips
 * @returns {Object}
 */
export const aggregateFinanceStats = (trips = []) => {
  const rawStats = trips.reduce(
    (acc, trip) => {
      acc.totalTons += Number(trip.tonelaje || 0);
      acc.totalBilling += Number(trip.valorPago || 0);
      acc.totalAcpm += trip.usoAcpm ? Number(trip.consumoAcpm || 0) : 0;
      if (trip.usoFerry) {
        acc.totalFerryCrossings += 1;
      }

      const driverVal = Number(trip.valorConductor || 0);
      const acpmVal = trip.usoAcpm ? Number(trip.valorAcpm || 0) : 0;
      const ferryVal = trip.usoFerry ? Number(trip.valorFerry || 0) : 0;

      acc.totalDriverPayout += driverVal;
      acc.totalAcpmCost += acpmVal;
      acc.totalFerryCost += ferryVal;

      const tripExpenses = driverVal + acpmVal + ferryVal;
      acc.totalExpenses += tripExpenses;
      acc.totalNet += Number(trip.valorPago || 0) - tripExpenses;

      return acc;
    },
    {
      totalTons: 0,
      totalBilling: 0,
      totalAcpm: 0,
      totalFerryCrossings: 0,
      totalDriverPayout: 0,
      totalAcpmCost: 0,
      totalFerryCost: 0,
      totalExpenses: 0,
      totalNet: 0
    }
  );

  return {
    totalTons: round3(rawStats.totalTons),
    totalBilling: round2(rawStats.totalBilling),
    totalAcpm: round3(rawStats.totalAcpm),
    totalFerryCrossings: rawStats.totalFerryCrossings,
    totalDriverPayout: round2(rawStats.totalDriverPayout),
    totalAcpmCost: round2(rawStats.totalAcpmCost),
    totalFerryCost: round2(rawStats.totalFerryCost),
    totalExpenses: round2(rawStats.totalExpenses),
    totalNet: round2(rawStats.totalNet)
  };
};
