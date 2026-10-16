import { z } from 'zod';

export const tripSchema = z.strictObject({
  ticket: z.preprocess((val) => parseInt(val, 10), z.number().int().positive('El ticket debe ser un número entero positivo')),
  fecha: z.preprocess((arg) => {
    if (typeof arg == "string" || arg instanceof Date) return new Date(arg);
  }, z.date({ invalid_type_error: "Fecha inválida" }).refine((date) => {
    const endOfToday = new Date();
    endOfToday.setUTCHours(23, 59, 59, 999);
    return date <= endOfToday;
  }, { message: 'La fecha del viaje no puede ser una fecha futura' })),
  origen: z.string().min(1, 'El origen es obligatorio').max(150),
  destino: z.string().max(150).optional().nullable(),
  empresa: z.string().max(100).optional().nullable(),
  producto: z.enum(['FRUTO', 'COMPOST']),
  tonelaje: z.number().positive('El tonelaje debe ser positivo').max(60, 'El tonelaje excede el límite físico permitido (60 Ton). Verifique que esté expresado en toneladas y no en kilogramos'),
  valorPago: z.number().positive('El valor del flete debe ser un número positivo'),
  consumoAcpm: z.number().nonnegative().optional().nullable(),
  usoAcpm: z.boolean().optional().default(false),
  usoFerry: z.boolean().optional().default(false),
  porcentajeConductor: z.number().min(0, 'El porcentaje del conductor no puede ser negativo').max(100, 'El porcentaje del conductor no puede superar el 100%').optional().nullable(),
  valorAcpm: z.number().nonnegative().optional().nullable(),
  valorFerry: z.number().nonnegative().optional().nullable(),
  driverId: z.string().uuid('ID de conductor inválido'),
  vehicleId: z.string().uuid('ID de vehículo inválido'),
});

export const updateTripSchema = tripSchema.partial().strict();
