import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import jwt from 'jsonwebtoken';

const prismaMock = vi.hoisted(() => ({
  refreshToken: {
    findUnique: vi.fn()
  }
}));

vi.mock('../../src/config/db.js', () => ({
  prisma: prismaMock
}));

import { validate } from '../../src/middlewares/validate.middleware.js';
import { adminMiddleware } from '../../src/middlewares/role.middleware.js';
import { authMiddleware } from '../../src/middlewares/auth.middleware.js';

const createRes = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis()
  };
  return res;
};

describe('Middlewares — validate (Firewall Zod)', () => {
  const schema = z.strictObject({ nombre: z.string().trim().min(2) });

  it('reemplaza req.body con el objeto sanitizado y llama next()', () => {
    const req = { body: { nombre: '  Palma  ' } };
    const res = createRes();
    const next = vi.fn();

    validate(schema)(req, res, next);

    expect(req.body).toEqual({ nombre: 'Palma' });
    expect(next).toHaveBeenCalledOnce();
  });

  it('devuelve 400 con detalle de campos cuando Zod rechaza el payload', () => {
    const req = { body: { nombre: 'A', campoExtra: true } };
    const res = createRes();
    const next = vi.fn();

    validate(schema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error', message: 'Validación de datos fallida' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('devuelve 500 ante un error inesperado no-Zod', () => {
    const brokenSchema = { parse: () => { throw new Error('boom'); } };
    const req = { body: {} };
    const res = createRes();
    const next = vi.fn();

    validate(brokenSchema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('Middlewares — adminMiddleware (RBAC)', () => {
  it('permite paso cuando req.user.rol es ADMIN', () => {
    const req = { user: { id: 'u1', rol: 'ADMIN' } };
    const res = createRes();
    const next = vi.fn();

    adminMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('retorna 403 cuando falta req.user o el rol es OPERADOR', () => {
    const res1 = createRes();
    const next1 = vi.fn();
    adminMiddleware({}, res1, next1);
    expect(res1.status).toHaveBeenCalledWith(403);
    expect(next1).not.toHaveBeenCalled();

    const res2 = createRes();
    const next2 = vi.fn();
    adminMiddleware({ user: { id: 'u2', rol: 'OPERADOR' } }, res2, next2);
    expect(res2.status).toHaveBeenCalledWith(403);
    expect(next2).not.toHaveBeenCalled();
  });
});

describe('Middlewares — authMiddleware (Stub + Spy sobre Prisma y Cookies)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test_secret_key_novapalma';
  });

  it('retorna 401 si no viene cookie ni header Authorization', async () => {
    const req = { cookies: {}, headers: {} };
    const res = createRes();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('inyecta req.user con rol fresco de BD y llama next() para token válido y sesión activa', async () => {
    const token = jwt.sign({ id: 'user-1', rol: 'OPERADOR' }, process.env.JWT_SECRET, { algorithm: 'HS256' });
    prismaMock.refreshToken.findUnique.mockResolvedValue({
      token,
      revoked: false,
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: 'user-1', rol: 'ADMIN', activo: true, deletedAt: null }
    });

    const req = { cookies: { token }, headers: {} };
    const res = createRes();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(prismaMock.refreshToken.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { token } })
    );
    expect(req.user).toEqual({ id: 'user-1', rol: 'ADMIN' });
    expect(next).toHaveBeenCalledOnce();
  });

  it('limpia cookie (Spy) y retorna 401 si la sesión está revocada o expirada', async () => {
    const token = jwt.sign({ id: 'user-1', rol: 'ADMIN' }, process.env.JWT_SECRET, { algorithm: 'HS256' });
    prismaMock.refreshToken.findUnique.mockResolvedValue({
      token,
      revoked: true,
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: 'user-1', rol: 'ADMIN', activo: true, deletedAt: null }
    });

    const req = { cookies: {}, headers: { authorization: `Bearer ${token}` } };
    const res = createRes();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(res.clearCookie).toHaveBeenCalledWith('token', expect.objectContaining({ httpOnly: true }));
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('limpia cookie y retorna 401 si el JWT tiene firma inválida', async () => {
    const badToken = jwt.sign({ id: 'user-1' }, 'otra_clave_secreta', { algorithm: 'HS256' });
    const req = { cookies: { token: badToken }, headers: {} };
    const res = createRes();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(res.clearCookie).toHaveBeenCalledWith('token', expect.any(Object));
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
