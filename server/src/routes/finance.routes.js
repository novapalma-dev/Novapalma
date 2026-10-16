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
        const parsedStart = new Date(startDate);
        if (Number.isNaN(parsedStart.getTime())) {
          return res.status(400).json({ error: 'La fecha inicial no tiene un formato válido' });
        }
        whereClause.fecha.gte = parsedStart;
      }
      if (endDate) {
        const parsedEnd = new Date(endDate + 'T23:59:59.999Z');
        if (Number.isNaN(parsedEnd.getTime())) {
          return res.status(400).json({ error: 'La fecha final no tiene un formato válido' });
        }
        whereClause.fecha.lte = parsedEnd;
      }
      if (whereClause.fecha.gte && whereClause.fecha.lte && whereClause.fecha.gte > whereClause.fecha.lte) {
        return res.status(400).json({ error: 'La fecha inicial no puede ser posterior a la fecha final' });
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
    const rawStats = trips.reduce(
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

    const round2 = (n) => Math.round(n * 100) / 100;
    const round3 = (n) => Math.round(n * 1000) / 1000;
    const stats = {
      totalTons: round3(rawStats.totalTons),
      totalBilling: round2(rawStats.totalBilling),
      totalAcpm: round3(rawStats.totalAcpm),
      totalFerryCrossings: rawStats.totalFerryCrossings,
      totalDriverPayout: round2(rawStats.totalDriverPayout),
      totalAcpmCost: round2(rawStats.totalAcpmCost),
      totalFerryCost: round2(rawStats.totalFerryCost),
      totalExpenses: round2(rawStats.totalExpenses),
      totalNet: round2(rawStats.totalNet)
    };

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
