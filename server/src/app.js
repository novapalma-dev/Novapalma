import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import routes from './routes/index.routes.js';

const app = express();

/**
 * ============================================================
 * CAPA DE SEGURIDAD PERIMETRAL (Hardening)
 * ============================================================
 * Como DevOps Senior, la prioridad es minimizar la superficie de ataque.
 */

// 1. HELMET: Configura cabeceras HTTP seguras para mitigar ataques como 
// XSS, Clickjacking y Sniffing de contenido.
app.use(helmet());

// 2. CORS: Restringe el acceso a orígenes conocidos.
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://mi-proyecto-pern.vercel.app',
  'https://novapalma-bay.vercel.app',
  'https://novapalma.vercel.app'
];

app.use(cors({
  origin: (origin, callback) => {
    // Permitir llamadas sin origen (como postman, curl o herramientas internas)
    if (!origin) return callback(null, true);

    const clientUrls = (process.env.CLIENT_URL || '')
      .split(',')
      .map(u => u.trim().replace(/\/+$/, ''))
      .filter(Boolean);

    const normalizedOrigin = origin.replace(/\/+$/, '');

    let isAllowed = 
      allowedOrigins.includes(normalizedOrigin) || 
      clientUrls.includes(normalizedOrigin) || 
      process.env.NODE_ENV !== 'production';

    // Permitir despliegues dinámicos y preview branches de Vercel del proyecto
    if (!isAllowed) {
      try {
        const parsed = new URL(origin);
        if (parsed.hostname.endsWith('.vercel.app')) {
          isAllowed = true;
        }
      } catch {
        isAllowed = false;
      }
    }

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error(`Bloqueado por políticas CORS de Novapalma: ${origin}`));
    }
  },
  credentials: true // Crucial para permitir el envío de HttpOnly Cookies
}));

// 3. RATE LIMITING: Defensa contra ataques de denegación de servicio (DoS) 
// y fuerza bruta en endpoints sensibles.
// Blindaje de red: Acotar trust proxy al número específico de saltos del reverse proxy
// (por defecto 1), evitando spoofing de IP mediante cabeceras X-Forwarded-For manipuladas.
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 1)); 

// Limitador exclusivo para el Login (Previene Fuerza Bruta en contraseñas)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // Ventana de 15 minutos
  max: 15, // Máximo 15 intentos de login por IP cada 15 minutos
  message: 'Demasiados intentos de inicio de sesión desde esta IP. Por favor intente de nuevo en 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Limitador general para el resto de la API (Navegación y consultas)
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // Ventana de 1 minuto
  max: process.env.NODE_ENV === 'production' ? 250 : 1000, // 250 en producción, 1000 en desarrollo (evita bloqueos de HMR/refrescos)
  message: 'Demasiadas solicitudes desde esta IP, por favor intente más tarde (Límite temporal de 1 minuto activo).',
  standardHeaders: true,
  legacyHeaders: false,
});

// Aplicar políticas por endpoints
app.use('/api/auth/login', loginLimiter);
app.use('/api/', apiLimiter);

/**
 * ============================================================
 * MIDDLEWARES DE PARSEO Y SESIÓN
 * ============================================================
 */

// Parseo de JSON con límite de carga para evitar ataques de Payload Gigante
app.use(express.json({ limit: '10kb' }));

// Parseo de cookies para manejo seguro de sesiones vía HttpOnly Cookies
app.use(cookieParser());

/**
 * ============================================================
 * ENRUTAMIENTO (CAPA DE DOMINIO)
 * ============================================================
 */
app.use('/api', routes);

// Ruta de bienvenida
app.get('/', (req, res) => {
  res.send('🚀 Backend Logística Novapalma (MVC Potenciado) - Funcionando');
});

// Manejador de errores global (Security Best Practice: No filtrar stacks de error al cliente)
app.use((err, req, res, next) => {
  console.error('💥 Critical Error:', err.stack);
  res.status(500).json({ 
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Consulte los logs del sistema'
  });
});

export default app;
