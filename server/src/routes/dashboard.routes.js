import { Router } from 'express';
import { prisma } from '../config/db.js';

const router = Router();

router.get('/stats', async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));

    const [tripsThisMonth, activeVehicles, activeDrivers, billingResult] = await Promise.all([
      prisma.trip.count({
        where: {
          deletedAt: null,
          fecha: {
            gte: startOfMonth,
            lte: endOfMonth
          }
        }
      }),
      prisma.vehicle.count({
        where: {
          activo: true,
          deletedAt: null
        }
      }),
      prisma.driver.count({
        where: {
          activo: true,
          deletedAt: null
        }
      }),
      prisma.trip.aggregate({
        _sum: {
          valorPago: true
        },
        where: {
          deletedAt: null,
          fecha: {
            gte: startOfMonth,
            lte: endOfMonth
          }
        }
      })
    ]);

    const totalBilling = Number(billingResult._sum.valorPago || 0);

    res.json({
      tripsThisMonth,
      activeVehicles,
      activeDrivers,
      totalBilling
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Error al calcular estadísticas en el servidor' });
  }
});

export default router;
