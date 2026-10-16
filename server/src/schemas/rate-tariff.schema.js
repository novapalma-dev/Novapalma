import { z } from 'zod';

export const rateTariffSchema = z.strictObject({
  producto: z.enum(['FRUTO', 'COMPOST']),
  valorKg: z.number().positive('El valor por kilogramo debe ser un número positivo'),
  activo: z.boolean().optional().default(true),
});

export const updateRateTariffSchema = rateTariffSchema.partial().strict();

export const systemSettingsSchema = z.strictObject({
  defaultPriceKg: z.preprocess((val) => String(val ?? '100').trim(), z.string().regex(/^\d+(\.\d+)?$/, 'El precio por kilo debe ser un número positivo')),
  defaultAcpm: z.preprocess((val) => String(val ?? '0').trim(), z.string().regex(/^\d+(\.\d+)?$/, 'El costo de ACPM debe ser un número no negativo')),
  defaultFerry: z.preprocess((val) => String(val ?? '0').trim(), z.string().regex(/^\d+(\.\d+)?$/, 'El costo de Ferry debe ser un número no negativo')),
  defaultOrigen: z.string().trim().max(150).optional().default(''),
  defaultDestino: z.string().trim().max(150).optional().default(''),
  thousandSeparator: z.enum(['.', ',']).optional().default('.'),
});
