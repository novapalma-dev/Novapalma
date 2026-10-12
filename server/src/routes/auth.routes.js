import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

import { validate } from '../middlewares/validate.middleware.js';
import { loginSchema, profileSchema } from '../schemas/auth.schema.js';

const router = Router();

router.post('/login', validate(loginSchema), authController.login);
router.post('/logout', authController.logout);
router.put('/perfil', authMiddleware, validate(profileSchema), authController.updateProfile);

export default router;

