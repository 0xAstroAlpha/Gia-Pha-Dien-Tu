import { Router } from 'express';
import { backupController } from './controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';

const router = Router();
router.use(authMiddleware);

// Admin only
router.post('/', requireRole('ADMIN'), backupController.createBackup);
router.get('/', requireRole('ADMIN'), backupController.listBackups);
router.get('/:id/download', requireRole('ADMIN'), backupController.downloadBackup);

export const backupRoutes = router;
