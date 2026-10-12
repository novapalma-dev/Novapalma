import { z } from 'zod';
import { createUserSchema } from './user.schema.js';

/**
 * Credenciales de login. Garantiza tipos string (evita 500 en bcrypt.compare con objetos/arrays)
 * y normaliza el correo para evitar cuentas duplicadas por mayúsculas.
 */
export const loginSchema = z.strictObject({
  correo: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(255),
});

/**
 * Autoservicio de perfil: whitelist SIN `rol`, `activo`, `correo` ni campos de sistema.
 */
export const profileSchema = createUserSchema
  .pick({ primerNombre: true, segundoNombre: true, primerApellido: true, segundoApellido: true, password: true })
  .partial()
  .strict();
