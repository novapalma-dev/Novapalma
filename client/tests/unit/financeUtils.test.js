import { describe, it, expect } from 'vitest';
import {
  filterTripsByTicket,
  computeDisplayedFinanceStats,
  formatTripsForExcel
} from '../../src/utils/financeUtils.js';

const SAMPLE_TRIPS = [
  {
    ticket: 1001,
    fecha: '2026-10-05T00:00:00.000Z',
    origen: 'Finca Norte',
    destino: 'Planta Central',
    empresa: 'Novapalma',
    producto: 'FRUTO',
    tonelaje: 10.5,
    valorPago: 1050000,
    valorConductor: 105000,
    usoAcpm: true,
    valorAcpm: 200000,
    usoFerry: true,
    valorFerry: 50000,
    vehicle: { placa: 'ABC123' },
    driver: { primerNombre: 'Juan', primerApellido: 'Pérez' }
  },
  {
    ticket: 2045,
    fecha: '2026-10-06T00:00:00.000Z',
    origen: 'Finca Sur',
    destino: null,
    empresa: null,
    producto: 'COMPOST',
    tonelaje: 0,
    valorPago: 500000,
    valorConductor: 50000,
    usoAcpm: false,
    valorAcpm: 999999, // debe ignorarse (BL-07)
    usoFerry: false,
    valorFerry: 88888, // debe ignorarse (BL-07)
    vehicle: null,
    driver: null
  }
];

describe('Frontend Utils — filterTripsByTicket', () => {
  it('retorna todos los viajes si searchTerm está vacío y filtra por coincidencia parcial', () => {
    expect(filterTripsByTicket(SAMPLE_TRIPS, '')).toHaveLength(2);
    expect(filterTripsByTicket(SAMPLE_TRIPS, '204')).toHaveLength(1);
    expect(filterTripsByTicket(SAMPLE_TRIPS, '204')[0].ticket).toBe(2045);
    expect(filterTripsByTicket(SAMPLE_TRIPS, '9999')).toHaveLength(0);
  });
});

describe('Frontend Utils — computeDisplayedFinanceStats (BL-13)', () => {
  it('retorna las estadísticas del servidor cuando no hay búsqueda activa', () => {
    const serverStats = { totalTons: 99, totalBilling: 999999 };
    expect(computeDisplayedFinanceStats(SAMPLE_TRIPS, serverStats, '   ')).toBe(serverStats);
  });

  it('recalcula gastos y utilidad neta sobre viajes filtrados respetando flags usoAcpm/usoFerry', () => {
    const stats = computeDisplayedFinanceStats(SAMPLE_TRIPS, {}, '1');

    expect(stats).toEqual({
      totalTons: 10.5,
      totalBilling: 1550000,
      totalDriverPayout: 155000,
      totalAcpmCost: 200000,
      totalFerryCost: 50000,
      totalExpenses: 405000,
      totalNet: 1145000
    });
  });
});

describe('Frontend Utils — formatTripsForExcel', () => {
  it('genera las columnas de planilla Excel calculando kilogramos, gastos, neto y evitando división por cero', () => {
    const rows = formatTripsForExcel(SAMPLE_TRIPS);

    expect(rows[0]).toMatchObject({
      PLACA: 'ABC123',
      Conductor: 'Juan Pérez',
      TIQUETE: 1001,
      KILOGRAMOS: 10500,
      'VALOR TONELADA': 100,
      'VALOR FLETE VIAJE': 1050000,
      ACPM: 200000,
      FERRY: 50000,
      GASTOS: 355000,
      NETO: 695000
    });

    expect(rows[1]).toMatchObject({
      PLACA: '',
      Conductor: '',
      Empresa: 'N/A',
      DESTINO: 'N/A',
      'VALOR TONELADA': 0, // tonelaje=0 no produce Infinity/NaN
      ACPM: 0,
      FERRY: 0,
      GASTOS: 50000,
      NETO: 450000
    });
  });
});
