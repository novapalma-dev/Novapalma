import { z } from 'zod';

export const vehicleSchema = z.strictObject({
  placa: z.string().regex(/^[A-Z]{3}[0-9]{3}$/, 'La placa debe tener formato AAA000 (3 letras y 3 números)'),
  marca: z.string().min(2, 'La marca debe tener al menos 2 caracteres').regex(/^[a-zA-Z0-9\s.-]+$/, 'La marca solo puede contener letras, números, guiones y puntos').max(50),
  modelo: z.string().min(2, 'El modelo debe tener al menos 2 caracteres').regex(/^[a-zA-Z0-9\s.-]+$/, 'El modelo solo puede contener letras, números, guiones y puntos').max(100),
  capacidad: z.number().positive('La capacidad debe ser un número positivo (toneladas)'),
  estado: z.enum(['DISPONIBLE', 'EN_VIAJE', 'MANTENIMIENTO']).optional().default('DISPONIBLE'),
});

// Reactivación (soft-delete inverso) exclusiva de ADMIN: solo se permite el par exacto
// activo/deletedAt=null; cualquier otro campo de sistema es rechazado por strict().
export const updateVehicleSchema = vehicleSchema.partial().extend({
  activo: z.boolean().optional(),
  deletedAt: z.null().optional(),
}).strict();
