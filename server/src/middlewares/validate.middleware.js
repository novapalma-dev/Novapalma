import { ZodError } from 'zod';

/**
 * ============================================================
 * MIDDLEWARE DE VALIDACIÓN DE CONTRATOS (VALIDATE MIDDLEWARE)
 * ============================================================
 * Actúa como un "Firewall de Datos" en la capa perimetral del enrutamiento.
 * Intercepta los payloads entrantes y los contrasta contra esquemas Zod rigurosos,
 * previniendo que datos sucios, mal formateados o maliciosos alcancen la capa de servicios.
 */

/**
 * Genera un middleware Express personalizado para validar el body contra un esquema Zod.
 * 
 * @param {ZodSchema} schema - Esquema de Zod contra el cual validar el body de la petición
 * @returns {Function} Middleware de Express (req, res, next)
 */
export const validate = (schema) => (req, res, next) => {
  try {
    // Si la validación pasa, se REEMPLAZA el body crudo por el resultado parseado
    // (whitelist estricta + tipos transformados) para impedir mass assignment.
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    // Interceptamos específicamente fallos de validación estructural de Zod
    if (error instanceof ZodError) {
      return res.status(400).json({
        status: 'error',
        message: 'Validación de datos fallida',
        errors: (error.issues || []).map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
    }

    // Si ocurre un error imprevisto (ej. desbordamiento de pila), evitamos fugas de información
    console.error('❌ Error inesperado en el middleware de validación:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor durante la validación',
    });
  }
};


