import { Router } from 'express';
import multer from 'multer';
import { mediaController } from './controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';

const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// All routes require auth
router.use(authMiddleware);

// Upload (Member+)
router.post('/', requireRole('MEMBER'), upload.single('file'), mediaController.upload);

// List (Member+)
router.get('/', requireRole('MEMBER'), mediaController.list);

// Get single (Member+)
router.get('/:id', requireRole('MEMBER'), mediaController.getById);

// Approve / Reject (Archivist+)
router.post('/:id/approve', requireRole('ARCHIVIST'), mediaController.approve);
router.post('/:id/reject', requireRole('ARCHIVIST'), mediaController.reject);

// Delete (Admin)
router.delete('/:id', requireRole('ADMIN'), mediaController.delete);

export const mediaRoutes = router;
