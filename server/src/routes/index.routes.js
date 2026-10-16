import { Router } from 'express';
import userRoutes from './user.routes.js';
import vehicleRoutes from './vehicle.routes.js';
import driverRoutes from './driver.routes.js';
import tripRoutes from './trip.routes.js';
import authRoutes from './auth.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import financeRoutes from './finance.routes.js';
import settingsRoutes from './settings.routes.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { adminMiddleware } from '../middlewares/role.middleware.js';

const router = Router();

// Rutas Públicas
router.use('/auth', authRoutes);

// Rutas Protegidas
router.use('/usuarios', authMiddleware, adminMiddleware, userRoutes);
router.use('/vehiculos', authMiddleware, vehicleRoutes);
router.use('/conductores', authMiddleware, driverRoutes);
router.use('/viajes', authMiddleware, tripRoutes);
router.use('/dashboard', authMiddleware, dashboardRoutes);
router.use('/finanzas', authMiddleware, adminMiddleware, financeRoutes);
router.use('/configuracion', authMiddleware, settingsRoutes);

export default router;
