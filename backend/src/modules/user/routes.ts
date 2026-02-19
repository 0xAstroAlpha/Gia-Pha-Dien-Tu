import { Router } from 'express';
import { userController } from './controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';

const router = Router();

// All user routes require authentication
router.use(authMiddleware);

// Profile (self)
router.get('/me', userController.getProfile);
router.patch('/me', userController.updateProfile);

// Admin-only routes
router.get('/', requireRole('ADMIN'), userController.listUsers);
router.patch('/:id/role', requireRole('ADMIN'), userController.updateRole);
router.patch('/:id/status', requireRole('ADMIN'), userController.updateStatus);

// Invite management (Admin)
router.post('/invite', requireRole('ADMIN'), userController.createInvite);
router.get('/invite', requireRole('ADMIN'), userController.listInvites);

export const userRoutes = router;
