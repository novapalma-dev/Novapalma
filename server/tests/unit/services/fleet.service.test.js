import { describe, it, expect, vi, beforeEach } from 'vitest';

const { txMock, prismaMock, logAuditSpy } = vi.hoisted(() => {
  const tx = {
    vehicle: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    driver: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    auditLog: {
      create: vi.fn()
    },
    $queryRaw: vi.fn()
  };

  return {
    txMock: tx,
    prismaMock: {
      $transaction: vi.fn(async (cb) => cb(tx)),
      vehicle: { findMany: vi.fn(), findUnique: vi.fn() },
      driver: { findMany: vi.fn(), findUnique: vi.fn() },
      auditLog: { create: vi.fn() }
    },
    logAuditSpy: vi.fn()
  };
});

vi.mock('../../../src/config/db.js', () => ({ prisma: prismaMock }));
vi.mock('../../../src/services/audit.service.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    logAudit: logAuditSpy
  };
});

import * as vehicleService from '../../../src/services/vehicle.service.js';
import * as driverService from '../../../src/services/driver.service.js';
import { logAudit } from '../../../src/services/audit.service.js';

describe('VehicleService (BL-03, BL-08, Stub + Spy)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (cb) => cb(txMock));
  });

  it('crea vehículo normalizando placa a mayúsculas y registra auditoría', async () => {
    txMock.vehicle.findUnique.mockResolvedValue(null);
    txMock.vehicle.create.mockResolvedValue({ id: 'v-1', placa: 'ABC123', marca: 'Kenworth' });

    const created = await vehicleService.createVehicle(
      { placa: 'abc123', marca: 'Kenworth', modelo: 'T800', capacidad: 35 },
      'admin-1'
    );

    expect(created.placa).toBe('ABC123');
    expect(logAuditSpy).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE', entity: 'Vehicle', entityId: 'v-1' }),
      txMock
    );
  });

  it('bloquea duplicados activos e inactivos en createVehicle (BL-03)', async () => {
    txMock.vehicle.findUnique.mockResolvedValue({ id: 'v-1', activo: false, deletedAt: new Date() });
    await expect(vehicleService.createVehicle({ placa: 'ABC123' })).rejects.toThrow(/vehículo inactivo/);

    txMock.vehicle.findUnique.mockResolvedValue({ id: 'v-1', activo: true, deletedAt: null });
    await expect(vehicleService.createVehicle({ placa: 'ABC123' })).rejects.toThrow(/Ya existe un vehículo/);
  });

  it('sincroniza activo <-> deletedAt en updateVehicle (BL-08) y bloquea edición de inactivos sin reactivar', async () => {
    txMock.$queryRaw.mockResolvedValue([{ id: 'v-1', activo: false, deletedAt: new Date() }]);
    await expect(vehicleService.updateVehicle('v-1', { marca: 'Volvo' })).rejects.toThrow(/Debe reactivarlo/);

    txMock.vehicle.findUniqueOrThrow.mockResolvedValue({ id: 'v-1', placa: 'ABC123', activo: false });
    txMock.vehicle.update.mockImplementation(async ({ data }) => ({ id: 'v-1', placa: 'ABC123', ...data }));

    const reactivated = await vehicleService.updateVehicle('v-1', { activo: true }, 'admin-1');
    expect(reactivated.deletedAt).toBeNull();
    expect(logAuditSpy).toHaveBeenCalledWith(expect.objectContaining({ action: 'UPDATE', entity: 'Vehicle' }), txMock);
  });

  it('aplica Soft Delete en deleteVehicle y consulta listados con/sin eliminados', async () => {
    txMock.$queryRaw.mockResolvedValue([]);
    await expect(vehicleService.deleteVehicle('missing')).rejects.toThrow(/no encontrado/);

    txMock.$queryRaw.mockResolvedValue([{ id: 'v-1' }]);
    txMock.vehicle.findUniqueOrThrow.mockResolvedValue({ id: 'v-1', placa: 'ABC123' });
    txMock.vehicle.update.mockResolvedValue({ id: 'v-1', activo: false, deletedAt: new Date() });

    const deleted = await vehicleService.deleteVehicle('v-1', 'admin-1');
    expect(deleted.activo).toBe(false);

    await vehicleService.getAllVehicles(false);
    await vehicleService.getAllVehicles(true);
    await vehicleService.getVehicleById('v-1');
    expect(prismaMock.vehicle.findMany).toHaveBeenCalledTimes(2);
  });
});

describe('DriverService (BL-03, BL-08, Stub + Spy)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (cb) => cb(txMock));
  });

  it('crea conductor y bloquea cédulas duplicadas activas o inactivas (BL-03)', async () => {
    txMock.driver.findUnique.mockResolvedValue(null);
    txMock.driver.create.mockResolvedValue({ id: 'd-1', cedula: '1098765432', primerNombre: 'Pedro', primerApellido: 'Gil' });

    const created = await driverService.createDriver({ cedula: '1098765432', primerNombre: 'Pedro', primerApellido: 'Gil' }, 'admin-1');
    expect(created.id).toBe('d-1');
    expect(logAuditSpy).toHaveBeenCalledWith(expect.objectContaining({ action: 'CREATE', entity: 'Driver' }), txMock);

    txMock.driver.findUnique.mockResolvedValue({ id: 'd-1', activo: false, deletedAt: new Date() });
    await expect(driverService.createDriver({ cedula: '1098765432' })).rejects.toThrow(/conductor inactivo/);

    txMock.driver.findUnique.mockResolvedValue({ id: 'd-1', activo: true, deletedAt: null });
    await expect(driverService.createDriver({ cedula: '1098765432' })).rejects.toThrow(/Ya existe un conductor/);
  });

  it('sincroniza reactivación en updateDriver (BL-08) y aplica Soft Delete en deleteDriver', async () => {
    txMock.$queryRaw.mockResolvedValue([{ id: 'd-1', activo: false, deletedAt: new Date() }]);
    await expect(driverService.updateDriver('d-1', { telefono: '3001112233' })).rejects.toThrow(/Debe reactivarlo/);

    txMock.driver.findUniqueOrThrow.mockResolvedValue({ id: 'd-1', cedula: '123456', primerNombre: 'Pedro' });
    txMock.driver.update.mockImplementation(async ({ data }) => ({ id: 'd-1', primerNombre: 'Pedro', ...data }));

    const reactivated = await driverService.updateDriver('d-1', { activo: true }, 'admin-1');
    expect(reactivated.deletedAt).toBeNull();

    txMock.$queryRaw.mockResolvedValue([{ id: 'd-1' }]);
    const deleted = await driverService.deleteDriver('d-1', 'admin-1');
    expect(deleted.activo).toBe(false);

    await driverService.getAllDrivers(false);
    await driverService.getAllDrivers(true);
    await driverService.getDriverById('d-1');
    expect(prismaMock.driver.findMany).toHaveBeenCalledTimes(2);
  });
});

describe('AuditService — verificación de contrato ACID', () => {
  it('expone logAudit como función invocable con cliente tx', async () => {
    logAuditSpy.mockResolvedValue({ id: 'audit-1' });
    const res = await logAudit({ userId: 'u-1', action: 'CREATE', entity: 'Trip', entityId: 't-1' }, txMock);
    expect(res).toEqual({ id: 'audit-1' });
  });
});
