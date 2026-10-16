import { Router } from 'express';
import * as tripController from '../controllers/trip.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { tripSchema, updateTripSchema } from '../schemas/trip.schema.js';
import { adminMiddleware } from '../middlewares/role.middleware.js';

const router = Router();

router.get('/', tripController.getAll);
router.get('/:id', tripController.getById);
router.post('/', validate(tripSchema), tripController.create);

// Solo el ADMIN puede editar o eliminar viajes (según política de auditoría y RBAC)
router.put('/:id', adminMiddleware, validate(updateTripSchema), tripController.update);
router.delete('/:id', adminMiddleware, tripController.remove);

export default router;
