import { z } from 'zod';

export const driverSchema = z.strictObject({
  cedula: z.string().min(6, 'La cédula debe tener al menos 6 dígitos').regex(/^\d+$/, 'La cédula debe contener solo números').max(20),
  primerNombre: z.string().min(2, 'El primer nombre debe tener al menos 2 caracteres').regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, 'El primer nombre solo puede contener letras').max(60),
  segundoNombre: z.string().regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]*$/, 'El segundo nombre solo puede contener letras').max(60).optional().nullable(),
  primerApellido: z.string().min(2, 'El primer apellido debe tener al menos 2 caracteres').regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, 'El primer apellido solo puede contener letras').max(60),
  segundoApellido: z.string().regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]*$/, 'El segundo apellido solo puede contener letras').max(60).optional().nullable(),
  telefono: z.string().regex(/^\d*$/, 'El teléfono debe contener solo números').refine(val => !val || (val.length >= 7 && val.length <= 15), 'El teléfono debe tener entre 7 y 15 dígitos').optional().nullable(),
});

// Reactivación (soft-delete inverso) exclusiva de ADMIN: solo se permite el par exacto
// activo/deletedAt=null; cualquier otro campo de sistema es rechazado por strict().
export const updateDriverSchema = driverSchema.partial().extend({
  activo: z.boolean().optional(),
  deletedAt: z.null().optional(),
}).strict();
