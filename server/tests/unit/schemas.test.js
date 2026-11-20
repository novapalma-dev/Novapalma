import { describe, it, expect } from 'vitest';
import { tripSchema, updateTripSchema } from '../../src/schemas/trip.schema.js';
import { vehicleSchema, updateVehicleSchema } from '../../src/schemas/vehicle.schema.js';
import { driverSchema, updateDriverSchema } from '../../src/schemas/driver.schema.js';
import { createUserSchema, updateUserSchema } from '../../src/schemas/user.schema.js';
import { loginSchema, profileSchema } from '../../src/schemas/auth.schema.js';
import { rateTariffSchema, systemSettingsSchema } from '../../src/schemas/rate-tariff.schema.js';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('Schemas Zod — tripSchema (BL-05, BL-10, C1)', () => {
  const validTrip = {
    ticket: 1001,
    fecha: '2026-05-10',
    origen: 'Finca La Palma',
    destino: 'Planta Extractora',
    empresa: 'Novapalma SAS',
    producto: 'FRUTO',
    tonelaje: 25.5,
    valorPago: 1500000,
    porcentajeConductor: 10,
    usoAcpm: true,
    consumoAcpm: 15,
    valorAcpm: 150000,
    usoFerry: false,
    driverId: VALID_UUID,
    vehicleId: VALID_UUID
  };

  it('acepta un viaje válido y límites exactos (tonelaje=60, porcentajeConductor=0 y 100)', () => {
    expect(tripSchema.safeParse(validTrip).success).toBe(true);
    expect(tripSchema.safeParse({ ...validTrip, tonelaje: 60, porcentajeConductor: 100 }).success).toBe(true);
    expect(tripSchema.safeParse({ ...validTrip, tonelaje: 0.01, porcentajeConductor: 0 }).success).toBe(true);
  });

  it('rechaza tonelaje > 60 Ton, <= 0 y fechas futuras (BL-10)', () => {
    expect(tripSchema.safeParse({ ...validTrip, tonelaje: 60.01 }).success).toBe(false);
    expect(tripSchema.safeParse({ ...validTrip, tonelaje: 0 }).success).toBe(false);
    expect(tripSchema.safeParse({ ...validTrip, tonelaje: -5 }).success).toBe(false);

    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(tripSchema.safeParse({ ...validTrip, fecha: futureDate }).success).toBe(false);
  });

  it('rechaza porcentajeConductor > 100 o < 0 y campos extra por strict() (BL-05 / C1)', () => {
    expect(tripSchema.safeParse({ ...validTrip, porcentajeConductor: 100.1 }).success).toBe(false);
    expect(tripSchema.safeParse({ ...validTrip, porcentajeConductor: -1 }).success).toBe(false);
    expect(tripSchema.safeParse({ ...validTrip, registradoPorId: VALID_UUID }).success).toBe(false);
    expect(updateTripSchema.safeParse({ origen: 'Nuevo Origen' }).success).toBe(true);
  });
});

describe('Schemas Zod — vehicleSchema & driverSchema (BL-10, BL-14)', () => {
  const validVehicle = {
    placa: 'XYZ987',
    marca: 'Kenworth',
    modelo: 'T800',
    capacidad: 60,
    estado: 'DISPONIBLE'
  };

  const validDriver = {
    cedula: '1098765432',
    primerNombre: 'Juan',
    segundoNombre: 'Carlos',
    primerApellido: 'Pérez',
    segundoApellido: 'Rodríguez',
    telefono: '3105551234'
  };

  it('valida placa AAA000, límite de capacidad 60 Ton y modo estricto en vehículos', () => {
    expect(vehicleSchema.safeParse(validVehicle).success).toBe(true);
    expect(vehicleSchema.safeParse({ ...validVehicle, placa: 'AB12' }).success).toBe(false);
    expect(vehicleSchema.safeParse({ ...validVehicle, capacidad: 60.1 }).success).toBe(false);
    expect(vehicleSchema.safeParse({ ...validVehicle, capacidad: -1 }).success).toBe(false);
    expect(updateVehicleSchema.safeParse({ estado: 'MANTENIMIENTO' }).success).toBe(true);
  });

  it('valida límites de cédula (6–20 dígitos) y teléfono (7–15 dígitos) en conductores', () => {
    expect(driverSchema.safeParse(validDriver).success).toBe(true);
    expect(driverSchema.safeParse({ ...validDriver, cedula: '123456' }).success).toBe(true);
    expect(driverSchema.safeParse({ ...validDriver, cedula: '12345' }).success).toBe(false);
    expect(driverSchema.safeParse({ ...validDriver, cedula: '1+1' }).success).toBe(false);
    expect(driverSchema.safeParse({ ...validDriver, telefono: '123456' }).success).toBe(false);
    expect(driverSchema.safeParse({ ...validDriver, primerNombre: 'Juan123#' }).success).toBe(false);
    expect(updateDriverSchema.safeParse({ telefono: '3112223344' }).success).toBe(true);
  });
});

describe('Schemas Zod — userSchema, authSchema & rateTariffSchema (BL-01, BL-12, C1)', () => {
  it('normaliza correo a minúsculas y sin espacios en loginSchema y createUserSchema', () => {
    const loginParsed = loginSchema.parse({ correo: '  ADMIN@Novapalma.COM ', password: 'secret' });
    expect(loginParsed.correo).toBe('admin@novapalma.com');

    const userParsed = createUserSchema.parse({
      primerNombre: 'Andrés',
      primerApellido: 'Gómez',
      correo: '  Andres@Novapalma.COM ',
      password: 'ClaveSegura2026!',
      rol: 'OPERADOR'
    });
    expect(userParsed.correo).toBe('andres@novapalma.com');
    expect(updateUserSchema.safeParse({ rol: 'ADMIN', activo: true }).success).toBe(true);
  });

  it('exige currentPassword al cambiar contraseña y bloquea Mass Assignment de rol en profileSchema', () => {
    expect(profileSchema.safeParse({ primerNombre: 'Carlos' }).success).toBe(true);
    expect(profileSchema.safeParse({ password: 'NuevaPassword123!' }).success).toBe(false);
    expect(
      profileSchema.safeParse({
        password: 'NuevaPassword123!',
        currentPassword: 'PasswordActual123!'
      }).success
    ).toBe(true);
    // Intento de escalación de privilegios (C1/C2)
    expect(profileSchema.safeParse({ primerNombre: 'Carlos', rol: 'ADMIN' }).success).toBe(false);
  });

  it('valida rateTariffSchema y systemSettingsSchema (BL-09)', () => {
    expect(rateTariffSchema.safeParse({ producto: 'FRUTO', valorKg: 130 }).success).toBe(true);
    expect(rateTariffSchema.safeParse({ producto: 'OTRO', valorKg: 130 }).success).toBe(false);

    const parsedSettings = systemSettingsSchema.parse({
      defaultPriceKg: 120,
      defaultAcpm: 0,
      defaultFerry: 45000,
      thousandSeparator: '.'
    });
    expect(parsedSettings.defaultPriceKg).toBe('120');
    expect(systemSettingsSchema.safeParse({ defaultPriceKg: '-10' }).success).toBe(false);
  });
});
