/**
 * Rotas - Chat interno estilo WhatsApp
 * Multi-tenant 100% - instituicaoId sempre do JWT
 */
import { Router } from 'express';
import { authenticate, enforceTenant } from '../middlewares/auth.js';
import { validateLicense } from '../middlewares/license.middleware.js';
import * as chatController from '../controllers/chat.controller.js';
import { createThreadSchema, sendMessageSchema, getMessagesQuerySchema } from '../validators/chat.validator.js';
import { validateBody, validateQuery } from '../middlewares/validate.middleware.js';
import { chatUpload } from '../middlewares/chatUpload.middleware.js';

const router = Router();

router.use(authenticate);
router.use(validateLicense);
router.use(enforceTenant);

// 3.0 Upload de anexos (fotos, PDF, vídeos)
router.post('/upload', chatUpload.single('file'), chatController.uploadAttachment);

// 3.1 Listar conversas do usuário
router.get('/threads', chatController.listThreads);

// 3.3 Contagem de não lidas
router.get('/unread-count', chatController.getUnreadCount);

// 3.4 Contatos disponíveis para conversa DIRECT
router.get('/available-contacts', chatController.getAvailableContacts);

// 3.2 Criar/abrir conversa
router.post('/threads', validateBody(createThreadSchema), chatController.createThread);

// GET /chat/threads/:id/messages
router.get('/threads/:id/messages', validateQuery(getMessagesQuerySchema), chatController.getMessages);

// POST /chat/threads/:id/messages
router.post('/threads/:id/messages', validateBody(sendMessageSchema), chatController.sendMessage);

// PATCH /chat/threads/:id/read
router.patch('/threads/:id/read', chatController.markAsRead);

export default router;
