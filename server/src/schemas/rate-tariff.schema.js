import { z } from 'zod';

export const rateTariffSchema = z.strictObject({
  producto: z.enum(['FRUTO', 'COMPOST']),
  valorKg: z.number().positive('El valor por kilogramo debe ser un número positivo'),
  activo: z.boolean().optional().default(true),
});

export const updateRateTariffSchema = rateTariffSchema.partial().strict();
