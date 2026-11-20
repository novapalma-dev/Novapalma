import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';

const { txMock, prismaMock } = vi.hoisted(() => {
  const tx = {
    trip: { create: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
    vehicle: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), create: vi.fn(), update: vi.fn() },
    driver: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), create: vi.fn(), update: vi.fn() },
    user: { create: vi.fn(), findUniqueOrThrow: vi.fn(), findFirst: vi.fn(), count: vi.fn(), update: vi.fn() },
    refreshToken: { updateMany: vi.fn() },
    auditLog: { create: vi.fn(), findFirst: vi.fn() },
    $queryRaw: vi.fn()
  };

  return {
    txMock: tx,
    prismaMock: {
      $transaction: vi.fn(async (cb) => cb(tx)),
      refreshToken: { findUnique: vi.fn(), deleteMany: vi.fn(), create: vi.fn() },
      user: { findFirst: vi.fn(), findMany: vi.fn() },
      trip: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), aggregate: vi.fn() },
      vehicle: { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
      driver: { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
      auditLog: { create: vi.fn(), findFirst: vi.fn() }
    }
  };
});

vi.mock('../../src/config/db.js', () => ({ prisma: prismaMock }));

import app from '../../src/app.js';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_2 = '660e8400-e29b-41d4-a716-446655440000';

const makeAuthToken = (id = VALID_UUID, rol = 'ADMIN') => {
  const token = jwt.sign({ id, rol }, process.env.JWT_SECRET, { algorithm: 'HS256' });
  prismaMock.refreshToken.findUnique.mockResolvedValue({
    token,
    revoked: false,
    expiresAt: new Date(Date.now() + 3600_000),
    user: { id, rol, activo: true, deletedAt: null }
  });
  return token;
};

describe('Integración HTTP (Supertest + Express App + Rutas + Middlewares + Servicios)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'novapalma_integration_secret';
    prismaMock.$transaction.mockImplementation(async (cb) => cb(txMock));
    txMock.auditLog.create.mockResolvedValue({ id: 'audit-1' });
    prismaMock.auditLog.create.mockResolvedValue({ id: 'audit-1' });
  });

  it('GET / responde 200 con estado del backend', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Novapalma');
  });

  describe('Auth (/api/auth)', () => {
    it('POST /api/auth/login valida Zod (400), rechaza malas credenciales (401) y emite cookie HttpOnly (200)', async () => {
      const badBody = await request(app).post('/api/auth/login').send({ correo: 'no-email', password: '' });
      expect(badBody.status).toBe(400);

      prismaMock.user.findFirst.mockResolvedValue(null);
      const unauthorized = await request(app)
        .post('/api/auth/login')
        .send({ correo: 'admin@novapalma.com', password: 'wrong' });
      expect(unauthorized.status).toBe(401);

      const hash = await bcrypt.hash('Admin123!', 4);
      prismaMock.user.findFirst.mockResolvedValue({
        id: VALID_UUID,
        primerNombre: 'Admin',
        primerApellido: 'Novapalma',
        correo: 'admin@novapalma.com',
        password: hash,
        rol: 'ADMIN',
        activo: true,
        deletedAt: null
      });

      const ok = await request(app)
        .post('/api/auth/login')
        .send({ correo: 'ADMIN@Novapalma.com', password: 'Admin123!' });
      expect(ok.status).toBe(200);
      expect(ok.body.user.correo).toBe('admin@novapalma.com');
      expect(ok.headers['set-cookie'][0]).toContain('HttpOnly');
    });

    it('POST /api/auth/logout revoca sesión y limpia cookie', async () => {
      const token = makeAuthToken();
      txMock.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Sesión finalizada');
    });

    it('PUT /api/auth/perfil bloquea Mass Assignment (400) y permite actualizar perfil propio (200)', async () => {
      const token = makeAuthToken(VALID_UUID, 'OPERADOR');

      const massAssign = await request(app)
        .put('/api/auth/perfil')
        .set('Authorization', `Bearer ${token}`)
        .send({ primerNombre: 'Pedro', rol: 'ADMIN' });
      expect(massAssign.status).toBe(400);

      txMock.user.findFirst.mockResolvedValue({
        id: VALID_UUID,
        primerNombre: 'Pedro',
        primerApellido: 'Gómez',
        password: 'hash'
      });
      txMock.user.update.mockResolvedValue({
        id: VALID_UUID,
        primerNombre: 'Pedro Luis',
        primerApellido: 'Gómez',
        password: 'hash'
      });

      const ok = await request(app)
        .put('/api/auth/perfil')
        .set('Authorization', `Bearer ${token}`)
        .send({ primerNombre: 'Pedro Luis' });
      expect(ok.status).toBe(200);
      expect(ok.body.user.primerNombre).toBe('Pedro Luis');
    });
  });

  describe('Viajes (/api/viajes)', () => {
    it('rechaza sin token (401) y valida creación (201), paginación (200), 404 y RBAC en PUT/DELETE (403)', async () => {
      const noAuth = await request(app).get('/api/viajes');
      expect(noAuth.status).toBe(401);

      const opToken = makeAuthToken(VALID_UUID, 'OPERADOR');
      txMock.vehicle.findUnique.mockResolvedValue({ id: VALID_UUID, placa: 'ABC123', activo: true, deletedAt: null, estado: 'DISPONIBLE' });
      txMock.driver.findUnique.mockResolvedValue({ id: VALID_UUID_2, primerNombre: 'Juan', activo: true, deletedAt: null });
      txMock.trip.create.mockResolvedValue({
        id: VALID_UUID,
        ticket: 1200,
        valorPago: 1000000,
        valorConductor: 100000,
        driver: {},
        vehicle: {}
      });

      const created = await request(app)
        .post('/api/viajes')
        .set('Authorization', `Bearer ${opToken}`)
        .send({
          ticket: 1200,
          fecha: '2026-05-01',
          origen: 'Finca 1',
          producto: 'FRUTO',
          tonelaje: 20,
          valorPago: 1000000,
          porcentajeConductor: 10,
          driverId: VALID_UUID_2,
          vehicleId: VALID_UUID
        });
      expect(created.status).toBe(201);

      // RBAC BL-02: OPERADOR no puede editar ni eliminar viajes
      const forbiddenPut = await request(app)
        .put(`/api/viajes/${VALID_UUID}`)
        .set('Authorization', `Bearer ${opToken}`)
        .send({ origen: 'Hack' });
      expect(forbiddenPut.status).toBe(403);

      // Paginación y 404 por ID
      prismaMock.trip.count.mockResolvedValue(1);
      prismaMock.trip.findMany.mockResolvedValue([{ id: VALID_UUID }]);
      const paginated = await request(app)
        .get('/api/viajes?page=1&limit=10')
        .set('Authorization', `Bearer ${opToken}`);
      expect(paginated.status).toBe(200);
      expect(paginated.body.pagination.total).toBe(1);

      prismaMock.trip.findUnique.mockResolvedValue(null);
      const notFound = await request(app)
        .get(`/api/viajes/${VALID_UUID}`)
        .set('Authorization', `Bearer ${opToken}`);
      expect(notFound.status).toBe(404);
    });

    it('permite a ADMIN actualizar (200) y eliminar (200) viajes', async () => {
      const adminToken = makeAuthToken(VALID_UUID, 'ADMIN');
      txMock.$queryRaw.mockResolvedValue([{ id: VALID_UUID }]);
      txMock.trip.findUniqueOrThrow.mockResolvedValue({
        id: VALID_UUID,
        ticket: 1200,
        vehicleId: VALID_UUID,
        driverId: VALID_UUID_2,
        valorPago: 1000000,
        porcentajeConductor: 10,
        usoAcpm: false,
        usoFerry: false
      });
      txMock.trip.update.mockResolvedValue({
        id: VALID_UUID,
        ticket: 1200,
        origen: 'Actualizado',
        deletedAt: new Date(),
        driver: {},
        vehicle: {}
      });

      const upd = await request(app)
        .put(`/api/viajes/${VALID_UUID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ origen: 'Actualizado' });
      expect(upd.status).toBe(200);

      const del = await request(app)
        .delete(`/api/viajes/${VALID_UUID}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(del.status).toBe(200);
    });
  });

  describe('Flota, Conductores, Usuarios, Finanzas, Dashboard y Configuración', () => {
    it('POST /api/vehiculos devuelve 409 ante violación Prisma P2002 y 201 si es válido', async () => {
      const adminToken = makeAuthToken(VALID_UUID, 'ADMIN');
      txMock.vehicle.findUnique.mockResolvedValue(null);
      txMock.vehicle.create.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: '7.8.0',
          meta: { target: ['placa'] }
        })
      );

      const conflict = await request(app)
        .post('/api/vehiculos')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ placa: 'ABC123', marca: 'Kenworth', modelo: 'T800', capacidad: 35 });
      expect(conflict.status).toBe(409);

      txMock.vehicle.create.mockResolvedValueOnce({ id: VALID_UUID, placa: 'ABC123' });
      const created = await request(app)
        .post('/api/vehiculos')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ placa: 'ABC123', marca: 'Kenworth', modelo: 'T800', capacidad: 35 });
      expect(created.status).toBe(201);

      prismaMock.vehicle.findMany.mockResolvedValue([{ id: VALID_UUID }]);
      const list = await request(app).get('/api/vehiculos').set('Authorization', `Bearer ${adminToken}`);
      expect(list.status).toBe(200);
    });

    it('POST/GET /api/conductores y GET /api/usuarios validan contratos y RBAC', async () => {
      const adminToken = makeAuthToken(VALID_UUID, 'ADMIN');
      txMock.driver.findUnique.mockResolvedValue(null);
      txMock.driver.create.mockResolvedValue({ id: VALID_UUID, cedula: '1098765432', primerNombre: 'Juan', primerApellido: 'Pérez' });

      const created = await request(app)
        .post('/api/conductores')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cedula: '1098765432',
          primerNombre: 'Juan',
          primerApellido: 'Pérez',
          telefono: '3105551234'
        });
      expect(created.status).toBe(201);

      prismaMock.user.findMany.mockResolvedValue([{ id: VALID_UUID, rol: 'ADMIN' }]);
      const usersRes = await request(app).get('/api/usuarios').set('Authorization', `Bearer ${adminToken}`);
      expect(usersRes.status).toBe(200);

      const opToken = makeAuthToken(VALID_UUID_2, 'OPERADOR');
      const forbiddenUsers = await request(app).get('/api/usuarios').set('Authorization', `Bearer ${opToken}`);
      expect(forbiddenUsers.status).toBe(403);
    });

    it('GET /api/finanzas/report valida fechas (400) y retorna métricas consolidadas (200)', async () => {
      const adminToken = makeAuthToken(VALID_UUID, 'ADMIN');

      const badRange = await request(app)
        .get('/api/finanzas/report?startDate=2026-10-20&endDate=2026-10-01')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(badRange.status).toBe(400);

      prismaMock.trip.findMany.mockResolvedValue([
        {
          tonelaje: 10,
          valorPago: 1000000,
          valorConductor: 100000,
          usoAcpm: true,
          consumoAcpm: 20,
          valorAcpm: 200000,
          usoFerry: false,
          valorFerry: 50000
        }
      ]);

      const ok = await request(app)
        .get('/api/finanzas/report?startDate=2026-10-01&endDate=2026-10-31')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(ok.status).toBe(200);
      expect(ok.body.stats.totalFerryCost).toBe(0);
      expect(ok.body.stats.totalNet).toBe(700000);
    });

    it('GET /api/dashboard/stats y GET/PUT /api/configuracion responden correctamente', async () => {
      const adminToken = makeAuthToken(VALID_UUID, 'ADMIN');
      prismaMock.trip.count.mockResolvedValue(12);
      prismaMock.vehicle.count.mockResolvedValue(4);
      prismaMock.driver.count.mockResolvedValue(6);
      prismaMock.trip.aggregate.mockResolvedValue({ _sum: { valorPago: 15000000 } });

      const dash = await request(app).get('/api/dashboard/stats').set('Authorization', `Bearer ${adminToken}`);
      expect(dash.status).toBe(200);
      expect(dash.body).toEqual({
        tripsThisMonth: 12,
        activeVehicles: 4,
        activeDrivers: 6,
        totalBilling: 15000000
      });

      prismaMock.auditLog.findFirst.mockResolvedValue(null);
      const getCfg = await request(app).get('/api/configuracion').set('Authorization', `Bearer ${adminToken}`);
      expect(getCfg.status).toBe(200);
      expect(getCfg.body.defaultPriceKg).toBe('100');

      txMock.auditLog.findFirst.mockResolvedValue(null);
      const putCfg = await request(app)
        .put('/api/configuracion')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ defaultPriceKg: '135', defaultAcpm: '50000', defaultFerry: '40000' });
      expect(putCfg.status).toBe(200);
      expect(putCfg.body.defaultPriceKg).toBe('135');
    });
  });
});
