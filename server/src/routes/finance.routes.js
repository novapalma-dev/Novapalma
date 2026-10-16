import { Router } from 'express';
import { prisma } from '../config/db.js';
import { adminMiddleware } from '../middlewares/role.middleware.js';

const router = Router();

router.get('/report', adminMiddleware, async (req, res) => {
  const { startDate, endDate } = req.query;

  try {
    const whereClause = {
      deletedAt: null
    };

    if (startDate || endDate) {
      whereClause.fecha = {};
      if (startDate) {
        whereClause.fecha.gte = new Date(startDate);
      }
      if (endDate) {
        whereClause.fecha.lte = new Date(endDate + 'T23:59:59.999Z');
      }
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

    // Aggregates
    const stats = trips.reduce(
      (acc, trip) => {
        acc.totalTons += Number(trip.tonelaje);
        acc.totalBilling += Number(trip.valorPago);
        acc.totalAcpm += trip.usoAcpm ? Number(trip.consumoAcpm || 0) : 0;
        if (trip.usoFerry) {
          acc.totalFerryCrossings += 1;
        }

        // Sumar costos reales en COP respetando el estado lógico de usoAcpm y usoFerry
        const driverVal = Number(trip.valorConductor || 0);
        const acpmVal = trip.usoAcpm ? Number(trip.valorAcpm || 0) : 0;
        const ferryVal = trip.usoFerry ? Number(trip.valorFerry || 0) : 0;

        acc.totalDriverPayout += driverVal;
        acc.totalAcpmCost += acpmVal;
        acc.totalFerryCost += ferryVal;

        const tripExpenses = driverVal + acpmVal + ferryVal;
        acc.totalExpenses += tripExpenses;
        acc.totalNet += Number(trip.valorPago) - tripExpenses;

        return acc;
      },
      { 
        totalTons: 0, 
        totalBilling: 0, 
        totalAcpm: 0, 
        totalFerryCrossings: 0,
        totalDriverPayout: 0,
        totalAcpmCost: 0,
        totalFerryCost: 0,
        totalExpenses: 0,
        totalNet: 0
      }
    );

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
