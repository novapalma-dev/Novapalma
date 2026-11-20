import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * ============================================================================
 * PRUEBAS UNITARIAS CON MOCKS (STUB + SPY) — TripService
 * ============================================================================
 * Aísla completamente PostgreSQL/Prisma y verifica:
 *  - STUB: respuestas controladas de tx.vehicle, tx.driver, tx.trip, tx.$queryRaw
 *  - SPY:  invocación exacta de auditService.logAudit dentro de la misma transacción tx
 */

const { txMock, prismaMock, logAuditSpy } = vi.hoisted(() => {
  const tx = {
    vehicle: { findUnique: vi.fn() },
    driver: { findUnique: vi.fn() },
    trip: {
      create: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn()
    },
    $queryRaw: vi.fn()
  };

  return {
    txMock: tx,
    prismaMock: {
      $transaction: vi.fn(async (cb) => cb(tx)),
      trip: {
        findMany: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn()
      }
    },
    logAuditSpy: vi.fn()
  };
});

vi.mock('../../../src/config/db.js', () => ({ prisma: prismaMock }));
vi.mock('../../../src/services/audit.service.js', () => ({ logAudit: logAuditSpy }));

import * as tripService from '../../../src/services/trip.service.js';

const ACTIVE_VEHICLE = { id: 'veh-1', placa: 'XYZ987', activo: true, deletedAt: null, estado: 'DISPONIBLE' };
const ACTIVE_DRIVER = { id: 'drv-1', primerNombre: 'Juan', activo: true, deletedAt: null };

describe('TripService — createTrip (Mocks Stub + Spy)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (cb) => cb(txMock));
  });

  it('crea un viaje, calcula comisión, normaliza flags BL-07 y registra auditoría en la misma tx', async () => {
    // Arrange (Stub)
    txMock.vehicle.findUnique.mockResolvedValue(ACTIVE_VEHICLE);
    txMock.driver.findUnique.mockResolvedValue(ACTIVE_DRIVER);
    txMock.trip.create.mockImplementation(async ({ data }) => ({
      id: 'trip-1',
      ...data,
      driver: ACTIVE_DRIVER,
      vehicle: ACTIVE_VEHICLE
    }));

    const tripInput = {
      ticket: 5001,
      fecha: '2026-10-15',
      origen: 'Finca A',
      destino: 'Planta B',
      producto: 'FRUTO',
      tonelaje: 12.5,
      valorPago: 1000000,
      porcentajeConductor: 10,
      usoAcpm: false,
      consumoAcpm: 40, // debe anularse a 0 (BL-07)
      valorAcpm: 400000, // debe anularse a 0 (BL-07)
      usoFerry: true,
      valorFerry: 75000,
      vehicleId: 'veh-1',
      driverId: 'drv-1'
    };

    // Act
    const created = await tripService.createTrip(tripInput, 'admin-1', {
      ipAddress: '181.50.1.1',
      userAgent: 'Vitest'
    });

    // Assert (Reglas de negocio + Spy)
    expect(created.valorConductor).toBe(100000);
    expect(created.consumoAcpm).toBe(0);
    expect(created.valorAcpm).toBe(0);
    expect(created.valorFerry).toBe(75000);

    expect(logAuditSpy).toHaveBeenCalledOnce();
    expect(logAuditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        action: 'CREATE',
        entity: 'Trip',
        entityId: 'trip-1',
        ipAddress: '181.50.1.1',
        userAgent: 'Vitest'
      }),
      txMock
    );
  });

  it('bloquea la asignación de un vehículo en estado MANTENIMIENTO (BL-11) sin crear ni auditar', async () => {
    // Arrange
    txMock.vehicle.findUnique.mockResolvedValue({ ...ACTIVE_VEHICLE, estado: 'MANTENIMIENTO' });

    // Act & Assert
    await expect(
      tripService.createTrip({ vehicleId: 'veh-1', driverId: 'drv-1', valorPago: 500000 }, 'admin-1')
    ).rejects.toThrow(/MANTENIMIENTO/);

    expect(txMock.trip.create).not.toHaveBeenCalled();
    expect(logAuditSpy).not.toHaveBeenCalled();
  });

  it('rechaza si el vehículo o el conductor están inactivos o no existen', async () => {
    txMock.vehicle.findUnique.mockResolvedValue(null);
    await expect(
      tripService.createTrip({ vehicleId: 'veh-x', driverId: 'drv-1', valorPago: 500000 }, 'admin-1')
    ).rejects.toThrow(/Vehículo no encontrado o inactivo/);

    txMock.vehicle.findUnique.mockResolvedValue(ACTIVE_VEHICLE);
    txMock.driver.findUnique.mockResolvedValue({ ...ACTIVE_DRIVER, activo: false });
    await expect(
      tripService.createTrip({ vehicleId: 'veh-1', driverId: 'drv-x', valorPago: 500000 }, 'admin-1')
    ).rejects.toThrow(/Conductor no encontrado o inactivo/);
  });

  it('rechaza cuando valorPago es nulo o indefinido', async () => {
    txMock.vehicle.findUnique.mockResolvedValue(ACTIVE_VEHICLE);
    txMock.driver.findUnique.mockResolvedValue(ACTIVE_DRIVER);

    await expect(
      tripService.createTrip({ vehicleId: 'veh-1', driverId: 'drv-1' }, 'admin-1')
    ).rejects.toThrow(/valor del flete es obligatorio/i);
  });
});

describe('TripService — updateTrip, deleteTrip y consultas paginadas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (cb) => cb(txMock));
  });

  it('recalcula comisión, valida reasignación activa (BL-06) y anula costos desactivados (BL-07) en updateTrip', async () => {
    const oldTrip = {
      id: 'trip-1',
      ticket: 5001,
      vehicleId: 'veh-1',
      driverId: 'drv-1',
      valorPago: 1000000,
      porcentajeConductor: 10,
      usoAcpm: true,
      usoFerry: true
    };
    txMock.$queryRaw.mockResolvedValue([{ id: 'trip-1' }]);
    txMock.trip.findUniqueOrThrow.mockResolvedValue(oldTrip);
    txMock.vehicle.findUnique.mockResolvedValue({ ...ACTIVE_VEHICLE, id: 'veh-2' });
    txMock.driver.findUnique.mockResolvedValue({ ...ACTIVE_DRIVER, id: 'drv-2' });
    txMock.trip.update.mockImplementation(async ({ data }) => ({
      id: 'trip-1',
      ticket: 5001,
      ...data,
      driver: ACTIVE_DRIVER,
      vehicle: ACTIVE_VEHICLE
    }));

    const updated = await tripService.updateTrip(
      'trip-1',
      {
        vehicleId: 'veh-2',
        driverId: 'drv-2',
        valorPago: 2000000,
        usoAcpm: false,
        usoFerry: false
      },
      'admin-1'
    );

    expect(updated.valorConductor).toBe(200000);
    expect(updated.consumoAcpm).toBe(0);
    expect(updated.valorAcpm).toBe(0);
    expect(updated.valorFerry).toBe(0);
    expect(logAuditSpy).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE', entity: 'Trip', entityId: 'trip-1' }),
      txMock
    );
  });

  it('lanza error en updateTrip y deleteTrip si FOR UPDATE no encuentra fila activa', async () => {
    txMock.$queryRaw.mockResolvedValue([]);

    await expect(tripService.updateTrip('missing', { origen: 'X' }, 'admin-1')).rejects.toThrow(
      /Viaje no encontrado/
    );
    await expect(tripService.deleteTrip('missing', 'admin-1')).rejects.toThrow(/Viaje no encontrado/);
  });

  it('aplica Soft Delete y audita en deleteTrip', async () => {
    const oldTrip = { id: 'trip-1', ticket: 5001 };
    txMock.$queryRaw.mockResolvedValue([{ id: 'trip-1' }]);
    txMock.trip.findUniqueOrThrow.mockResolvedValue(oldTrip);
    txMock.trip.update.mockResolvedValue({ ...oldTrip, deletedAt: new Date() });

    const deleted = await tripService.deleteTrip('trip-1', 'admin-1', { ipAddress: '1.1.1.1' });

    expect(deleted.deletedAt).toBeInstanceOf(Date);
    expect(logAuditSpy).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELETE', entity: 'Trip', entityId: 'trip-1' }),
      txMock
    );
  });

  it('retorna estructura paginada correcta en getTripsPaginated y consulta por ID', async () => {
    prismaMock.trip.count.mockResolvedValue(25);
    prismaMock.trip.findMany.mockResolvedValue([{ id: 'trip-1' }]);
    prismaMock.trip.findUnique.mockResolvedValue({ id: 'trip-1' });

    const pageRes = await tripService.getTripsPaginated({ page: 2, limit: 10, search: '5001' });
    expect(pageRes.pagination).toEqual({
      total: 25,
      page: 2,
      limit: 10,
      totalPages: 3,
      hasNextPage: true,
      hasPrevPage: true
    });

    await tripService.getAllTrips();
    expect(prismaMock.trip.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { deletedAt: null } }));

    const one = await tripService.getTripById('trip-1');
    expect(one).toEqual({ id: 'trip-1' });
  });
});
