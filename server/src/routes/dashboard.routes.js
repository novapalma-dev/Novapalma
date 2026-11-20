import { Router } from 'express';
import { prisma } from '../config/db.js';
import { getMonthUtcRange } from '../utils/dateRange.js';

const router = Router();

router.get('/stats', async (req, res) => {
  try {
    const { startOfMonth, endOfMonth } = getMonthUtcRange();

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
