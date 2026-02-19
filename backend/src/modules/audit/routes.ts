import { Router } from 'express';
import { auditController } from './controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';

const router = Router();
router.use(authMiddleware);

// Admin only
router.get('/', requireRole('ADMIN'), auditController.list);
router.get('/:id', requireRole('ADMIN'), auditController.getById);

export const auditRoutes = router;
