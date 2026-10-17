import { Router } from 'express';
import { prisma } from '../config/db.js';
import * as auditService from '../services/audit.service.js';
import { adminMiddleware } from '../middlewares/role.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { systemSettingsSchema } from '../schemas/rate-tariff.schema.js';
import { getClientIp } from '../utils/network.js';

const router = Router();

const DEFAULT_SETTINGS = {
  defaultPriceKg: '100',
  defaultAcpm: '0',
  defaultFerry: '0',
  defaultOrigen: '',
  defaultDestino: '',
  thousandSeparator: '.'
};

/**
 * @route   GET /api/configuracion
 * @desc    Obtiene los parámetros y tarifas por defecto del sistema persistidos en BD
 * @access  Privado (ADMIN, OPERADOR)
 */
router.get('/', async (req, res) => {
  try {
    const latestConfig = await prisma.auditLog.findFirst({
      where: {
        entity: 'SystemSettings',
        entityId: 'GLOBAL'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const settings = latestConfig?.newValues && typeof latestConfig.newValues === 'object'
      ? { ...DEFAULT_SETTINGS, ...latestConfig.newValues }
      : DEFAULT_SETTINGS;

    res.json(settings);
  } catch (error) {
    console.error('Error fetching system settings:', error);
    res.status(500).json({ error: 'Error al obtener la configuración del sistema' });
  }
});

/**
 * @route   PUT /api/configuracion
 * @desc    Actualiza de forma atómica y auditada las tarifas y parámetros globales del sistema
 * @access  Privado (ADMIN)
 */
router.put('/', adminMiddleware, validate(systemSettingsSchema), async (req, res) => {
  const ipAddress = getClientIp(req);
  const userAgent = req.get('User-Agent');

  try {
    const updatedSettings = await prisma.$transaction(async (tx) => {
      const previousRecord = await tx.auditLog.findFirst({
        where: {
          entity: 'SystemSettings',
          entityId: 'GLOBAL'
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      const oldValues = previousRecord?.newValues && typeof previousRecord.newValues === 'object'
        ? { ...DEFAULT_SETTINGS, ...previousRecord.newValues }
        : DEFAULT_SETTINGS;

      const newValues = {
        ...oldValues,
        ...req.body
      };

      await auditService.logAudit({
        userId: req.user.id,
        action: 'UPDATE',
        entity: 'SystemSettings',
        entityId: 'GLOBAL',
        oldValues,
        newValues,
        ipAddress,
        userAgent
      }, tx);

      return newValues;
    });

    res.json(updatedSettings);
  } catch (error) {
    console.error('Error updating system settings:', error);
    res.status(500).json({ error: 'Error al guardar la configuración del sistema' });
  }
});

export default router;
