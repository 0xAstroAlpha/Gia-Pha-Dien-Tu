import { Router } from 'express';
import { genealogyController } from './controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';

const router = Router();

// All genealogy routes require authentication
router.use(authMiddleware);

// Read — Member+
router.get('/people', requireRole('MEMBER'), genealogyController.getPeople);
router.get('/people/:handle', requireRole('MEMBER'), genealogyController.getPerson);
router.get('/families', requireRole('MEMBER'), genealogyController.getFamilies);
router.get('/families/:handle', requireRole('MEMBER'), genealogyController.getFamily);
router.get('/tree', requireRole('MEMBER'), genealogyController.getTree);

// Write — Editor+
router.put('/people/:handle', requireRole('EDITOR'), genealogyController.updatePerson);
router.post('/people', requireRole('EDITOR'), genealogyController.addPerson);
router.post('/families', requireRole('EDITOR'), genealogyController.addFamily);

// Delete — Admin only
router.delete('/people/:handle', requireRole('ADMIN'), genealogyController.deletePerson);

export const genealogyRoutes = router;
