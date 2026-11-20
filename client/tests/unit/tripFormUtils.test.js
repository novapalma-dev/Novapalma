import { describe, it, expect } from 'vitest';
import {
  formatCurrencyCOP,
  calculateTripPayment,
  sanitizeTripInput
} from '../../src/utils/tripFormUtils.js';

describe('Frontend Utils — formatCurrencyCOP', () => {
  it('formatea montos colombianos con separador de miles por punto', () => {
    expect(formatCurrencyCOP(1500000)).toBe('1.500.000');
    expect(formatCurrencyCOP('85000')).toBe('85.000');
    expect(formatCurrencyCOP('$ 120.500 COP')).toBe('120.500');
  });

  it('retorna cadena vacía para valores nulos, vacíos o sin dígitos', () => {
    expect(formatCurrencyCOP('')).toBe('');
    expect(formatCurrencyCOP(null)).toBe('');
    expect(formatCurrencyCOP(undefined)).toBe('');
    expect(formatCurrencyCOP('abc')).toBe('');
  });
});

describe('Frontend Utils — calculateTripPayment', () => {
  it('calcula automáticamente kg * precioKg redondeado para producto FRUTO', () => {
    expect(
      calculateTripPayment({ producto: 'FRUTO', tonelaje: '8540', precioKg: '130', valorPago: '0' })
    ).toBe(1110200);

    expect(
      calculateTripPayment({ producto: 'FRUTO', tonelaje: '100.5', precioKg: '101', valorPago: '' })
    ).toBe(10151);
  });

  it('usa el valorPago manual para producto COMPOST y retorna 0 si falta dato', () => {
    expect(
      calculateTripPayment({ producto: 'COMPOST', tonelaje: '5000', precioKg: '130', valorPago: '950000' })
    ).toBe(950000);

    expect(
      calculateTripPayment({ producto: 'COMPOST', tonelaje: '', precioKg: '', valorPago: '' })
    ).toBe(0);
  });
});

describe('Frontend Utils — sanitizeTripInput (RF-Viajes-01 / BL-05)', () => {
  it('elimina caracteres no numéricos en ticket y campos monetarios', () => {
    expect(sanitizeTripInput('ticket', '10-AB+45')).toBe('1045');
    expect(sanitizeTripInput('valorPago', '$1.200.000')).toBe('1200000');
    expect(sanitizeTripInput('precioKg', '130e2')).toBe('1302');
  });

  it('elimina signos negativos en tonelaje/consumoAcpm y acota porcentajeConductor a máximo 100%', () => {
    expect(sanitizeTripInput('tonelaje', '-12.5')).toBe('12.5');
    expect(sanitizeTripInput('porcentajeConductor', '150')).toBe('100');
    expect(sanitizeTripInput('porcentajeConductor', '100')).toBe('100');
    expect(sanitizeTripInput('porcentajeConductor', '12.5')).toBe('12.5');
  });

  it('mantiene sin cambios campos de texto no numéricos', () => {
    expect(sanitizeTripInput('origen', 'Finca La Palma')).toBe('Finca La Palma');
  });
});
