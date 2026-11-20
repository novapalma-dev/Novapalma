/**
 * ============================================================================
 * UTILIDADES PURAS DE FORMULARIO DE VIAJES (Design for Testability - Frontend)
 * ============================================================================
 * Extraídas de client/src/pages/Trips.jsx para probar cálculos de flete,
 * formateo COP y sanitización de inputs en milisegundos con Vitest.
 */

/**
 * Formateador de moneda estilo colombiano (separador de miles con punto).
 *
 * @param {string|number|null|undefined} val
 * @returns {string}
 */
export const formatCurrencyCOP = (val) => {
  if (val === undefined || val === null || val === '') return '';
  const stringVal = val.toString().replace(/\D/g, '');
  if (!stringVal) return '';
  return Number(stringVal).toLocaleString('de-DE');
};

/**
 * Calcula el valor del flete pactado (automático para FRUTO, manual para COMPOST).
 * Para FRUTO: Kilogramos ingresados * Precio por Kg, redondeado al peso más cercano.
 *
 * @param {{ producto: string, tonelaje: string|number, precioKg: string|number, valorPago: string|number }} formData
 * @returns {number}
 */
export const calculateTripPayment = (formData) => {
  if (formData.producto === 'FRUTO') {
    const kg = parseFloat(formData.tonelaje) || 0;
    const priceKg = parseFloat(formData.precioKg) || 0;
    return Math.round(kg * priceKg);
  }
  return parseFloat(formData.valorPago) || 0;
};

/**
 * Sanitiza entradas numéricas del formulario de viajes (RF-Viajes-01 / BL-05).
 *
 * @param {string} name - Nombre del campo.
 * @param {string} value - Valor crudo ingresado.
 * @returns {string} Valor sanitizado.
 */
export const sanitizeTripInput = (name, value) => {
  const raw = String(value ?? '');

  if (name === 'ticket') {
    return raw.replace(/\D/g, '');
  }

  if (name === 'tonelaje' || name === 'consumoAcpm' || name === 'porcentajeConductor') {
    let cleaned = raw.replace(/-/g, '');
    if (cleaned !== '' && parseFloat(cleaned) < 0) {
      cleaned = '0';
    }
    if (name === 'porcentajeConductor' && cleaned !== '' && parseFloat(cleaned) > 100) {
      cleaned = '100';
    }
    return cleaned;
  }

  if (name === 'valorPago' || name === 'precioKg' || name === 'valorAcpm' || name === 'valorFerry') {
    return raw.replace(/\D/g, '');
  }

  return raw;
};
