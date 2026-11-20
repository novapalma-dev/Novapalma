import { Router } from 'express';
import { prisma } from '../config/db.js';
import { adminMiddleware } from '../middlewares/role.middleware.js';
import { buildFinanceDateFilter, aggregateFinanceStats } from '../utils/financeCalculations.js';

const router = Router();

router.get('/report', adminMiddleware, async (req, res) => {
  const { startDate, endDate } = req.query;

  try {
    const { whereClause, error } = buildFinanceDateFilter(startDate, endDate);
    if (error) {
      return res.status(400).json({ error });
    }

    const trips = await prisma.trip.findMany({
      where: whereClause,
      include: {
        driver: {
          select: { primerNombre: true, primerApellido: true, cedula: true }
        },
        vehicle: {
          select: { placa: true, marca: true }
        }
      },
      orderBy: {
        fecha: 'desc'
      }
    });

    const stats = aggregateFinanceStats(trips);

    res.json({
      trips,
      stats
    });
  } catch (error) {
    console.error('Error generating finance report:', error);
    res.status(500).json({ error: 'Error al generar reporte financiero' });
  }
});

export default router;
