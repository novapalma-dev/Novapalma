import { z } from 'zod';

export const createUserSchema = z.strictObject({
  primerNombre: z.string().min(2, 'El primer nombre debe tener al menos 2 caracteres').regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, 'El primer nombre solo puede contener letras').max(60),
  segundoNombre: z.string().regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]*$/, 'El segundo nombre solo puede contener letras').max(60).optional().nullable(),
  primerApellido: z.string().min(2, 'El primer apellido debe tener al menos 2 caracteres').regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, 'El primer apellido solo puede contener letras').max(60),
  segundoApellido: z.string().regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]*$/, 'El segundo apellido solo puede contener letras').max(60).optional().nullable(),
  correo: z.string().trim().toLowerCase().email('Debe ser un correo electrónico válido').max(200),
  password: z.string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(/[0-9]/, 'La contraseña debe contener al menos un número')
    .regex(/[^A-Za-z0-9]/, 'La contraseña debe contener al menos un carácter especial (ej. !@#$%^&*)')
    .max(255),
  rol: z.enum(['ADMIN', 'OPERADOR']).optional(),
});

export const updateUserSchema = createUserSchema.partial().extend({
  activo: z.boolean().optional(),
}).strict();

export const validateUser = (data) => {
  return createUserSchema.safeParse(data);
};
