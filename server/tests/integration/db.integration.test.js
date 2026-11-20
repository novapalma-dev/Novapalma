import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../../src/app.js';
import { prisma } from '../../src/config/db.js';

/**
 * ============================================================================
 * PRUEBAS DE INTEGRACIÓN CONTRA POSTGRESQL REAL (ACID + Persistencia + Auditoría)
 * ============================================================================
 * Ejecuta peticiones HTTP reales con Supertest contra la app Express + Prisma +
 * PostgreSQL, validando persistencia física, códigos HTTP (200, 201, 400, 401,
 * 403, 409) y trazabilidad en audit_logs.
 */

const RUN_TAG = `it_${Date.now()}`;
const ADMIN_EMAIL = `admin.${RUN_TAG}@novapalma.test`;
const OP_EMAIL = `op.${RUN_TAG}@novapalma.test`;
const TEST_PASS = 'TestPass2026!';
const TEST_PLATE = `Z${String(Date.now()).slice(-2).replace(/\d/g, 'A')}999`.slice(0, 6);
const TEST_CEDULA = `99${String(Date.now()).slice(-8)}`;
const TEST_TICKET = Number(String(Date.now()).slice(-6));

describe('Integración Real PostgreSQL — Flujo Completo ACID + Auditoría', () => {
  let adminCookie = '';
  let operatorCookie = '';
  let adminUserId = '';
  let opUserId = '';
  let createdVehicleId = '';
  let createdDriverId = '';
  let createdTripId = '';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const hashedPassword = await bcrypt.hash(TEST_PASS, 4);

    const admin = await prisma.user.create({
      data: {
        primerNombre: 'Admin',
        primerApellido: 'Integracion',
        correo: ADMIN_EMAIL,
        password: hashedPassword,
        rol: 'ADMIN'
      }
    });
    adminUserId = admin.id;

    const op = await prisma.user.create({
      data: {
        primerNombre: 'Operador',
        primerApellido: 'Integracion',
        correo: OP_EMAIL,
        password: hashedPassword,
        rol: 'OPERADOR'
      }
    });
    opUserId = op.id;
  });

  afterAll(async () => {
    if (createdTripId) {
      await prisma.trip.deleteMany({ where: { id: createdTripId } });
    }
    if (createdVehicleId) {
      await prisma.vehicle.deleteMany({ where: { id: createdVehicleId } });
    }
    if (createdDriverId) {
      await prisma.driver.deleteMany({ where: { id: createdDriverId } });
    }
    const userIds = [adminUserId, opUserId].filter(Boolean);
    if (userIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
  });

  it('autentica ADMIN y OPERADOR emitiendo cookies HttpOnly reales y rechaza rutas protegidas sin sesión (401)', async () => {
    const unauth = await request(app).get('/api/viajes');
    expect(unauth.status).toBe(401);

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ correo: ADMIN_EMAIL.toUpperCase(), password: TEST_PASS });
    expect(adminLogin.status).toBe(200);
    adminCookie = adminLogin.headers['set-cookie'][0];

    const opLogin = await request(app)
      .post('/api/auth/login')
      .send({ correo: OP_EMAIL, password: TEST_PASS });
    expect(opLogin.status).toBe(200);
    operatorCookie = opLogin.headers['set-cookie'][0];
  });

  it('persiste Vehículo, Conductor y Viaje en PostgreSQL, verifica audit_logs y rechaza duplicados con 409', async () => {
    // 1. Crear vehículo real
    const vehRes = await request(app)
      .post('/api/vehiculos')
      .set('Cookie', adminCookie)
      .send({
        placa: `TZT${String(TEST_TICKET).slice(-3)}`,
        marca: 'Kenworth',
        modelo: 'T800',
        capacidad: 35,
        estado: 'DISPONIBLE'
      });
    expect(vehRes.status).toBe(201);
    createdVehicleId = vehRes.body.id;

    // 2. Crear conductor real
    const drvRes = await request(app)
      .post('/api/conductores')
      .set('Cookie', adminCookie)
      .send({
        cedula: TEST_CEDULA,
        primerNombre: 'Carlos',
        primerApellido: 'Prueba',
        telefono: '3101234567'
      });
    expect(drvRes.status).toBe(201);
    createdDriverId = drvRes.body.id;

    // 3. Crear viaje real y validar cálculo de comisión + persistencia
    const tripPayload = {
      ticket: TEST_TICKET,
      fecha: '2026-05-10',
      origen: 'Finca Integración',
      destino: 'Planta Extractora',
      producto: 'FRUTO',
      tonelaje: 20,
      valorPago: 1000000,
      porcentajeConductor: 10,
      usoAcpm: false,
      consumoAcpm: 50, // BL-07 debe forzarlo a 0 en BD
      valorAcpm: 500000, // BL-07 debe forzarlo a 0 en BD
      usoFerry: false,
      driverId: createdDriverId,
      vehicleId: createdVehicleId
    };

    const tripRes = await request(app)
      .post('/api/viajes')
      .set('Cookie', adminCookie)
      .send(tripPayload);
    expect(tripRes.status).toBe(201);
    createdTripId = tripRes.body.id;
    expect(Number(tripRes.body.valorConductor)).toBe(100000);
    expect(Number(tripRes.body.valorAcpm)).toBe(0);

    // 4. Confirmar persistencia directa en audit_logs
    const auditRecord = await prisma.auditLog.findFirst({
      where: { entity: 'Trip', entityId: createdTripId, action: 'CREATE' }
    });
    expect(auditRecord).not.toBeNull();
    expect(auditRecord.userId).toBe(adminUserId);

    // 5. Intentar duplicar el mismo ticket → 409 Conflict (Prisma P2002)
    const dupRes = await request(app)
      .post('/api/viajes')
      .set('Cookie', adminCookie)
      .send(tripPayload);
    expect(dupRes.status).toBe(409);

    // 6. Verificar RBAC BL-02: OPERADOR no puede modificar viaje ni consultar finanzas
    const opPut = await request(app)
      .put(`/api/viajes/${createdTripId}`)
      .set('Cookie', operatorCookie)
      .send({ origen: 'No Autorizado' });
    expect(opPut.status).toBe(403);

    const opFinance = await request(app)
      .get('/api/finanzas/report')
      .set('Cookie', operatorCookie);
    expect(opFinance.status).toBe(403);
  });
});
