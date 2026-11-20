import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const { txMock, prismaMock, logAuditSpy } = vi.hoisted(() => {
  const tx = {
    user: {
      create: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      update: vi.fn()
    },
    refreshToken: {
      updateMany: vi.fn()
    },
    $queryRaw: vi.fn()
  };

  return {
    txMock: tx,
    prismaMock: {
      $transaction: vi.fn(async (cb) => cb(tx)),
      user: {
        findFirst: vi.fn(),
        findMany: vi.fn()
      },
      refreshToken: {
        deleteMany: vi.fn(),
        create: vi.fn()
      }
    },
    logAuditSpy: vi.fn()
  };
});

vi.mock('../../../src/config/db.js', () => ({ prisma: prismaMock }));
vi.mock('../../../src/services/audit.service.js', () => ({ logAudit: logAuditSpy }));

import * as authService from '../../../src/services/auth.service.js';
import * as userService from '../../../src/services/user.service.js';

describe('AuthService — login y logout (Stub + Spy)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test_secret_novapalma';
    prismaMock.$transaction.mockImplementation(async (cb) => cb(txMock));
  });

  it('autentica normalizando correo (BL-01), purga tokens expirados y registra auditoría LOGIN', async () => {
    const hash = await bcrypt.hash('Clave123!', 4);
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'u-1',
      primerNombre: 'Admin',
      primerApellido: 'Principal',
      correo: 'admin@novapalma.com',
      password: hash,
      rol: 'ADMIN',
      activo: true,
      deletedAt: null
    });

    const result = await authService.login('  ADMIN@Novapalma.COM ', 'Clave123!', '10.0.0.1', 'Vitest');

    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: { correo: 'admin@novapalma.com', activo: true, deletedAt: null }
    });
    expect(result.token).toBeTruthy();
    expect(result.user.password).toBeUndefined();
    expect(prismaMock.refreshToken.deleteMany).toHaveBeenCalledOnce();
    expect(prismaMock.refreshToken.create).toHaveBeenCalledOnce();
    expect(logAuditSpy).toHaveBeenCalledWith(expect.objectContaining({ action: 'LOGIN', userId: 'u-1' }));
  });

  it('rechaza usuario inexistente o contraseña incorrecta', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    await expect(authService.login('nadie@novapalma.com', '123')).rejects.toThrow(/Credenciales inválidas/);

    const hash = await bcrypt.hash('Correcta', 4);
    prismaMock.user.findFirst.mockResolvedValue({ id: 'u-1', correo: 'a@b.com', password: hash });
    await expect(authService.login('a@b.com', 'Incorrecta')).rejects.toThrow(/Credenciales inválidas/);
  });

  it('revoca token válido en logout y audita solo si había sesión activa', async () => {
    const token = jwt.sign({ id: 'u-1', rol: 'ADMIN' }, process.env.JWT_SECRET, { algorithm: 'HS256' });
    txMock.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    await authService.logout(token, '1.1.1.1', 'Agent');
    expect(logAuditSpy).toHaveBeenCalledWith(expect.objectContaining({ action: 'LOGOUT', userId: 'u-1' }), txMock);

    // Token nulo o firma adulterada no debe lanzar error ni auditar
    vi.clearAllMocks();
    await authService.logout(null);
    await authService.logout('token.adulterado.firma');
    expect(logAuditSpy).not.toHaveBeenCalled();
  });
});

describe('UserService — RBAC, Quórum Admin (C7) y Perfil (BL-12)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (cb) => cb(txMock));
  });

  it('createUser exige creatorId con rol ADMIN activo y devuelve usuario sin password', async () => {
    await expect(userService.createUser({}, null)).rejects.toThrow(/identificación del creador/);

    prismaMock.user.findFirst.mockResolvedValue({ id: 'op-1', rol: 'OPERADOR', activo: true });
    await expect(userService.createUser({}, 'op-1')).rejects.toThrow(/privilegios de administrador/);

    prismaMock.user.findFirst.mockResolvedValue({ id: 'adm-1', rol: 'ADMIN', activo: true });
    txMock.user.create.mockResolvedValue({
      id: 'u-new',
      primerNombre: 'Luis',
      primerApellido: 'Díaz',
      correo: 'luis@novapalma.com',
      password: 'hashed_password',
      rol: 'OPERADOR'
    });

    const created = await userService.createUser(
      {
        primerNombre: 'Luis',
        primerApellido: 'Díaz',
        correo: '  LUIS@Novapalma.COM ',
        password: 'ClaveSegura2026!',
        rol: 'OPERADOR'
      },
      'adm-1'
    );

    expect(created.password).toBeUndefined();
    expect(logAuditSpy).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE', entity: 'User', entityId: 'u-new' }),
      txMock
    );
  });

  it('impide auto-bloqueo, auto-degradación y desactivación del único ADMIN activo (C7)', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 'adm-1', rol: 'ADMIN', activo: true });

    await expect(userService.updateUser('adm-1', { activo: false }, 'adm-1')).rejects.toThrow(
      /desactivar o suspender tu propia cuenta/
    );
    await expect(userService.updateUser('adm-1', { rol: 'OPERADOR' }, 'adm-1')).rejects.toThrow(
      /degradar tu propio rol/
    );

    // Otro admin, pero solo queda 1 activo en BD
    txMock.$queryRaw.mockResolvedValue([{ id: 'adm-2' }]);
    txMock.user.findUniqueOrThrow.mockResolvedValue({ id: 'adm-2', rol: 'ADMIN', activo: true });
    txMock.user.count.mockResolvedValue(1);

    await expect(userService.updateUser('adm-2', { activo: false }, 'adm-1')).rejects.toThrow(
      /único administrador activo/
    );
  });

  it('updateUser revoca sesiones activas cuando cambia rol o contraseña (C3)', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 'adm-1', rol: 'ADMIN', activo: true });
    txMock.$queryRaw.mockResolvedValue([{ id: 'op-2' }]);
    txMock.user.findUniqueOrThrow.mockResolvedValue({
      id: 'op-2',
      primerNombre: 'Ana',
      primerApellido: 'Ruiz',
      correo: 'ana@novapalma.com',
      rol: 'OPERADOR',
      activo: true
    });
    txMock.user.update.mockResolvedValue({
      id: 'op-2',
      primerNombre: 'Ana',
      primerApellido: 'Ruiz',
      correo: 'ana@novapalma.com',
      rol: 'ADMIN',
      activo: true,
      password: 'hash'
    });

    const updated = await userService.updateUser('op-2', { rol: 'ADMIN' }, 'adm-1');

    expect(updated.rol).toBe('ADMIN');
    expect(txMock.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'op-2', revoked: false },
      data: { revoked: true }
    });
  });

  it('updateOwnProfile exige currentPassword válido y preserva la sesión actual (BL-12)', async () => {
    await expect(userService.updateOwnProfile(null, {})).rejects.toThrow(/Sesión no válida/);
    await expect(userService.updateOwnProfile('u-1', { password: 'NuevaPassword123' })).rejects.toThrow(
      /contraseña actual/
    );

    const currentHash = await bcrypt.hash('Actual123!', 4);
    txMock.user.findFirst.mockResolvedValue({
      id: 'u-1',
      primerNombre: 'Ana',
      primerApellido: 'Ruiz',
      password: currentHash
    });

    await expect(
      userService.updateOwnProfile('u-1', { password: 'NuevaPassword123', currentPassword: 'Mal!' })
    ).rejects.toThrow(/contraseña actual ingresada es incorrecta/);

    txMock.user.update.mockResolvedValue({
      id: 'u-1',
      primerNombre: 'Ana María',
      primerApellido: 'Ruiz',
      password: 'new-hash'
    });

    const res = await userService.updateOwnProfile(
      'u-1',
      { primerNombre: 'Ana María', password: 'NuevaPassword123', currentPassword: 'Actual123!' },
      'current-jwt-token'
    );

    expect(res.password).toBeUndefined();
    expect(txMock.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ NOT: { token: 'current-jwt-token' } })
      })
    );
  });

  it('getAllUsers consulta excluyendo deletedAt', async () => {
    prismaMock.user.findMany.mockResolvedValue([]);
    await userService.getAllUsers();
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { deletedAt: null } }));
  });
});
