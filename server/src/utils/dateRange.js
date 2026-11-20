/**
 * ============================================================================
 * UTILIDADES PURAS DE RANGOS TEMPORALES UTC (Design for Testability - BL-04)
 * ============================================================================
 * Extraídas de dashboard.routes.js para probar límites de mes en UTC sin
 * depender del reloj local del sistema ni sufrir desfases por UTC-5.
 */

/**
 * Calcula el inicio y fin exactos en UTC del mes correspondiente a la fecha dada.
 *
 * @param {Date} [referenceDate=new Date()]
 * @returns {{ startOfMonth: Date, endOfMonth: Date }}
 */
export const getMonthUtcRange = (referenceDate = new Date()) => {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();

  const startOfMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const endOfMonth = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

  return { startOfMonth, endOfMonth };
};
