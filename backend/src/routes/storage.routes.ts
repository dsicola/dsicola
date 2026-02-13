import { Router } from 'express';
import multer from 'multer';
import * as storageController from '../controllers/storage.controller.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

router.post('/upload', authenticate, upload.single('file'), storageController.upload);
router.delete('/', authenticate, storageController.deleteFile);
router.get('/signed-url', authenticate, storageController.getSignedUrl);
router.get('/file/:bucket', authenticate, storageController.serveFile);

export default router;
