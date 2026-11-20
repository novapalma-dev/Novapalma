import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { formatError } from '../../src/utils/errorHandler.js';
import { getClientIp } from '../../src/utils/network.js';
import {
  calculateConductorPay,
  normalizeTripCosts,
  parseUpdateFields,
  buildTripsPaginationQuery
} from '../../src/utils/tripCalculations.js';
import {
  buildFinanceDateFilter,
  aggregateFinanceStats
} from '../../src/utils/financeCalculations.js';
import { getMonthUtcRange } from '../../src/utils/dateRange.js';

describe('Utils — calculateConductorPay (BL-05)', () => {
  it('aplica 1% por defecto cuando porcentajeConductor es undefined o null', () => {
    expect(calculateConductorPay(1000000, undefined)).toEqual({ pct: 1, valorConductor: 10000 });
    expect(calculateConductorPay(1000000, null)).toEqual({ pct: 1, valorConductor: 10000 });
  });

  it.each([
    [1000000, 0, { pct: 0, valorConductor: 0 }],
    [1000000, 10, { pct: 10, valorConductor: 100000 }],
    [1000000, 100, { pct: 100, valorConductor: 1000000 }],
    [333333.33, 7.5, { pct: 7.5, valorConductor: 25000 }],
    [100.1, 33.33, { pct: 33.33, valorConductor: 33.36 }]
  ])('calcula correctamente valorPago=%s con porcentaje=%s', (valorPago, pct, expected) => {
    expect(calculateConductorPay(valorPago, pct)).toEqual(expected);
  });

  it('rechaza valores límite fuera de rango (< 0, > 100 o NaN)', () => {
    expect(() => calculateConductorPay(500000, -0.01)).toThrow(/0% y 100%/);
    expect(() => calculateConductorPay(500000, 100.01)).toThrow(/0% y 100%/);
    expect(() => calculateConductorPay(500000, 'abc')).toThrow(/0% y 100%/);
  });
});

describe('Utils — normalizeTripCosts (BL-07)', () => {
  it('anula consumoAcpm, valorAcpm y valorFerry cuando los flags son false', () => {
    const result = normalizeTripCosts({
      usoAcpm: false,
      consumoAcpm: 45,
      valorAcpm: 450000,
      usoFerry: false,
      valorFerry: 120000
    });

    expect(result).toEqual({
      usoAcpm: false,
      usoFerry: false,
      consumoAcpm: 0,
      valorAcpm: 0,
      valorFerry: 0
    });
  });

  it('conserva los valores numéricos cuando los flags son true', () => {
    const result = normalizeTripCosts({
      usoAcpm: true,
      consumoAcpm: '32.5',
      valorAcpm: '310000',
      usoFerry: true,
      valorFerry: '85000'
    });

    expect(result).toEqual({
      usoAcpm: true,
      usoFerry: true,
      consumoAcpm: 32.5,
      valorAcpm: 310000,
      valorFerry: 85000
    });
  });

  it('usa 0 cuando los flags son true pero los importes son null o undefined', () => {
    const result = normalizeTripCosts({
      usoAcpm: true,
      consumoAcpm: null,
      valorAcpm: undefined,
      usoFerry: true,
      valorFerry: null
    });

    expect(result).toEqual({
      usoAcpm: true,
      usoFerry: true,
      consumoAcpm: 0,
      valorAcpm: 0,
      valorFerry: 0
    });
  });
});

describe('Utils — parseUpdateFields & buildTripsPaginationQuery', () => {
  it('convierte tipos de fecha y campos numéricos en parseUpdateFields', () => {
    const payload = {
      fecha: '2026-10-15',
      ticket: '1045',
      valorPago: '850000',
      porcentajeConductor: '12.5',
      consumoAcpm: '20',
      valorAcpm: '180000',
      valorFerry: '50000'
    };

    parseUpdateFields(payload);

    expect(payload.fecha).toBeInstanceOf(Date);
    expect(payload.ticket).toBe(1045);
    expect(payload.valorPago).toBe(850000);
    expect(payload.porcentajeConductor).toBe(12.5);
    expect(payload.consumoAcpm).toBe(20);
    expect(payload.valorAcpm).toBe(180000);
    expect(payload.valorFerry).toBe(50000);
  });

  it('acota page >= 1 y limit entre 1 y 100, y construye búsqueda por texto y ticket', () => {
    const clamped = buildTripsPaginationQuery({ page: -5, limit: 500, search: '  ' });
    expect(clamped.pageNum).toBe(1);
    expect(clamped.limitNum).toBe(100);
    expect(clamped.skip).toBe(0);
    expect(clamped.where).toEqual({ deletedAt: null });

    const withTicket = buildTripsPaginationQuery({ page: 2, limit: 10, search: '1045' });
    expect(withTicket.skip).toBe(10);
    expect(withTicket.where.OR).toContainEqual({ ticket: 1045 });

    const withText = buildTripsPaginationQuery({ page: 1, limit: 15, search: 'Aguachica' });
    expect(withText.where.OR.some((c) => c.ticket !== undefined)).toBe(false);
    expect(withText.where.OR).toContainEqual({ origen: { contains: 'Aguachica', mode: 'insensitive' } });
  });
});

describe('Utils — financeCalculations (BL-07 & BL-13)', () => {
  it('valida fechas inválidas y rango invertido en buildFinanceDateFilter', () => {
    expect(buildFinanceDateFilter('no-es-fecha', undefined).error).toMatch(/fecha inicial/i);
    expect(buildFinanceDateFilter(undefined, 'no-es-fecha').error).toMatch(/fecha final/i);
    expect(buildFinanceDateFilter('2026-10-20', '2026-10-01').error).toMatch(/posterior/i);
  });

  it('construye whereClause correcto con fechas válidas y sin fechas', () => {
    expect(buildFinanceDateFilter().whereClause).toEqual({ deletedAt: null });

    const { whereClause, error } = buildFinanceDateFilter('2026-10-01', '2026-10-31');
    expect(error).toBeUndefined();
    expect(whereClause.fecha.gte).toEqual(new Date('2026-10-01'));
    expect(whereClause.fecha.lte).toEqual(new Date('2026-10-31T23:59:59.999Z'));
  });

  it('agrega métricas respetando flags usoAcpm/usoFerry y redondeo a 2/3 decimales', () => {
    const trips = [
      {
        tonelaje: 10.1234,
        valorPago: 1000000.555,
        usoAcpm: true,
        consumoAcpm: 25.5556,
        valorAcpm: 200000,
        usoFerry: true,
        valorFerry: 50000,
        valorConductor: 100000
      },
      {
        tonelaje: 5.1,
        valorPago: 500000,
        usoAcpm: false,
        consumoAcpm: 99, // debe ignorarse por BL-07
        valorAcpm: 999999, // debe ignorarse por BL-07
        usoFerry: false,
        valorFerry: 88888, // debe ignorarse por BL-07
        valorConductor: 50000
      }
    ];

    const stats = aggregateFinanceStats(trips);

    expect(stats).toEqual({
      totalTons: 15.223,
      totalBilling: 1500000.56,
      totalAcpm: 25.556,
      totalFerryCrossings: 1,
      totalDriverPayout: 150000,
      totalAcpmCost: 200000,
      totalFerryCost: 50000,
      totalExpenses: 400000,
      totalNet: 1100000.56
    });
  });

  it('retorna ceros cuando no hay viajes', () => {
    expect(aggregateFinanceStats([])).toEqual({
      totalTons: 0,
      totalBilling: 0,
      totalAcpm: 0,
      totalFerryCrossings: 0,
      totalDriverPayout: 0,
      totalAcpmCost: 0,
      totalFerryCost: 0,
      totalExpenses: 0,
      totalNet: 0
    });
  });
});

describe('Utils — getMonthUtcRange (BL-04)', () => {
  it('calcula inicio exacto el día 1 a las 00:00:00.000Z y fin del último día del mes', () => {
    const ref = new Date('2026-02-01T02:00:00.000Z'); // En UTC-5 sería 31 de enero
    const { startOfMonth, endOfMonth } = getMonthUtcRange(ref);

    expect(startOfMonth.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    expect(endOfMonth.toISOString()).toBe('2026-02-28T23:59:59.999Z');
  });

  it('maneja años bisiestos correctamente (29 de febrero)', () => {
    const { endOfMonth } = getMonthUtcRange(new Date('2024-02-15T12:00:00.000Z'));
    expect(endOfMonth.toISOString()).toBe('2024-02-29T23:59:59.999Z');
  });
});

describe('Utils — getClientIp (BL-15 / C5)', () => {
  it('retorna null cuando req es nulo o indefinido', () => {
    expect(getClientIp(null)).toBeNull();
    expect(getClientIp(undefined)).toBeNull();
  });

  it('prioriza cf-connecting-ip sobre x-real-ip y x-forwarded-for', () => {
    const req = {
      headers: {
        'cf-connecting-ip': ' 181.50.10.20 ',
        'x-real-ip': '10.0.0.1',
        'x-forwarded-for': '200.1.2.3, 10.0.0.2'
      },
      ip: '127.0.0.1'
    };
    expect(getClientIp(req)).toBe('181.50.10.20');
  });

  it('extrae x-real-ip, primer salto de x-forwarded-for, req.ip y socket.remoteAddress', () => {
    expect(getClientIp({ headers: { 'x-real-ip': ' 190.1.1.1 ' } })).toBe('190.1.1.1');
    expect(getClientIp({ headers: { 'x-forwarded-for': ' 186.10.20.30 , 10.0.0.1' } })).toBe('186.10.20.30');
    expect(getClientIp({ headers: {}, ip: '192.168.1.5' })).toBe('192.168.1.5');
    expect(getClientIp({ headers: {}, socket: { remoteAddress: '::1' } })).toBe('::1');
  });
});

describe('Utils — formatError (God Node #1)', () => {
  const makeKnownError = (code, meta) =>
    new Prisma.PrismaClientKnownRequestError('Prisma error', {
      code,
      clientVersion: '7.8.0',
      meta
    });

  it('traduce P2002 (Unique Constraint) a 409 con mensaje específico o genérico', () => {
    expect(formatError(makeKnownError('P2002', { target: ['ticket'] }))).toMatchObject({
      status: 409,
      message: expect.stringContaining('ticket')
    });
    expect(formatError(makeKnownError('P2002', { target: 'placa' }))).toMatchObject({
      status: 409,
      message: expect.stringContaining('placa')
    });
    expect(formatError(makeKnownError('P2002', { target: ['otro_campo'] }))).toMatchObject({
      status: 409,
      message: expect.stringContaining('otro_campo')
    });
    expect(formatError(makeKnownError('P2002', {}))).toMatchObject({
      status: 409,
      message: expect.stringContaining('datos únicos')
    });
  });

  it('traduce P2003 (Foreign Key), P2025 (404), P2011 (400) y código desconocido', () => {
    expect(formatError(makeKnownError('P2003', { field_name: 'trips_driverId_fkey' }))).toMatchObject({
      status: 400,
      message: expect.stringContaining('conductor')
    });
    expect(formatError(makeKnownError('P2003', { field_name: 'custom_fk' }))).toMatchObject({
      status: 400,
      message: expect.stringContaining('custom_fk')
    });
    expect(formatError(makeKnownError('P2003', {}))).toMatchObject({
      status: 400,
      message: expect.stringContaining('referencia')
    });
    expect(formatError(makeKnownError('P2025'))).toMatchObject({ status: 404 });
    expect(formatError(makeKnownError('P2011'))).toMatchObject({ status: 400 });
    expect(formatError(makeKnownError('P9999'))).toMatchObject({
      status: 400,
      message: expect.stringContaining('P9999')
    });
  });

  it('traduce errores de validación, inicialización, pánico de Prisma y Error estándar', () => {
    const valErr = new Prisma.PrismaClientValidationError('bad', { clientVersion: '7.8.0' });
    const initErr = new Prisma.PrismaClientInitializationError('down', '7.8.0');
    const panicErr = new Prisma.PrismaClientRustPanicError('panic', '7.8.0');

    expect(formatError(valErr).status).toBe(400);
    expect(formatError(initErr).status).toBe(503);
    expect(formatError(panicErr).status).toBe(500);
    expect(formatError(new Error('Regla violada'))).toEqual({ status: 400, message: 'Regla violada' });
    expect(formatError({})).toEqual({
      status: 500,
      message: 'Ha ocurrido un error inesperado en el sistema.'
    });
  });
});
