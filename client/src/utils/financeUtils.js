/**
 * ============================================================================
 * UTILIDADES PURAS DE FINANZAS Y EXPORTACIÓN (Design for Testability - Frontend)
 * ============================================================================
 * Extraídas de client/src/pages/Finance.jsx para probar filtrado, agregados
 * locales y transformación de filas Excel sin montar componentes React.
 */

/**
 * Filtra los viajes por coincidencia parcial de número de ticket.
 *
 * @param {Array<Object>} trips
 * @param {string} searchTerm
 * @returns {Array<Object>}
 */
export const filterTripsByTicket = (trips = [], searchTerm = '') => {
  const term = String(searchTerm ?? '');
  if (term === '') return trips;
  return trips.filter((t) => String(t.ticket ?? '').includes(term));
};

/**
 * Calcula las estadísticas mostradas en el panel financiero.
 * Si searchTerm está vacío, devuelve las estadísticas globales del servidor;
 * si hay filtro activo, recalcula sobre los viajes filtrados respetando usoAcpm y usoFerry (BL-13).
 *
 * @param {Array<Object>} filteredTrips
 * @param {Object} serverStats
 * @param {string} searchTerm
 * @returns {Object}
 */
export const computeDisplayedFinanceStats = (filteredTrips = [], serverStats = {}, searchTerm = '') => {
  if (String(searchTerm ?? '').trim() === '') {
    return serverStats;
  }

  return filteredTrips.reduce(
    (acc, t) => {
      const billing = Number(t.valorPago || 0);
      const driverCost = Number(t.valorConductor || 0);
      const acpmCost = t.usoAcpm ? Number(t.valorAcpm || 0) : 0;
      const ferryCost = t.usoFerry ? Number(t.valorFerry || 0) : 0;
      const expenses = driverCost + acpmCost + ferryCost;

      return {
        totalTons: Number((acc.totalTons + Number(t.tonelaje || 0)).toFixed(3)),
        totalBilling: Number((acc.totalBilling + billing).toFixed(2)),
        totalDriverPayout: Number((acc.totalDriverPayout + driverCost).toFixed(2)),
        totalAcpmCost: Number((acc.totalAcpmCost + acpmCost).toFixed(2)),
        totalFerryCost: Number((acc.totalFerryCost + ferryCost).toFixed(2)),
        totalExpenses: Number((acc.totalExpenses + expenses).toFixed(2)),
        totalNet: Number((acc.totalNet + (billing - expenses)).toFixed(2))
      };
    },
    {
      totalTons: 0,
      totalBilling: 0,
      totalDriverPayout: 0,
      totalAcpmCost: 0,
      totalFerryCost: 0,
      totalExpenses: 0,
      totalNet: 0
    }
  );
};

/**
 * Transforma un listado de viajes al esquema exacto de columnas de la planilla Excel.
 *
 * @param {Array<Object>} trips
 * @returns {Array<Object>}
 */
export const formatTripsForExcel = (trips = []) => {
  return trips.map((t) => {
    const driverVal = Number(t.valorConductor || 0);
    const acpmVal = t.usoAcpm ? Number(t.valorAcpm || 0) : 0;
    const ferryVal = t.usoFerry ? Number(t.valorFerry || 0) : 0;
    const totalExpenses = driverVal + acpmVal + ferryVal;
    const netUtility = Number(t.valorPago || 0) - totalExpenses;

    const valorTon =
      Number(t.tonelaje) > 0
        ? parseFloat((Number(t.valorPago) / (Number(t.tonelaje) * 1000)).toFixed(3))
        : 0;

    return {
      'Fecha': new Date(t.fecha).toLocaleDateString(undefined, { timeZone: 'UTC' }),
      'PLACA': t.vehicle?.placa || '',
      'Conductor': t.driver ? `${t.driver.primerNombre} ${t.driver.primerApellido}` : '',
      'Empresa': t.empresa || 'N/A',
      'ORIGEN': t.origen || '',
      'DESTINO': t.destino || 'N/A',
      'PRODUCTO': t.producto || '',
      'TIQUETE': t.ticket || 0,
      'KILOGRAMOS': Number(t.tonelaje || 0) * 1000,
      'VALOR TONELADA': valorTon,
      'VALOR FLETE VIAJE': Number(t.valorPago || 0),
      'PORCENTAJE CONDUCTOR': driverVal,
      'ACPM': acpmVal,
      'FERRY': ferryVal,
      'GASTOS': totalExpenses,
      'NETO': netUtility
    };
  });
};
