/**
 * Controller - Chat interno estilo WhatsApp
 * Multi-tenant 100% - instituicaoId sempre do JWT
 */
import { Request, Response, NextFunction } from 'express';
import * as chatService from '../services/chat.service.js';
import { AppError } from '../middlewares/errorHandler.js';

/**
 * GET /chat/threads
 * Listar conversas do usuário
 */
export const listThreads = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const threads = await chatService.listThreads(req);
    res.json(threads);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /chat/threads
 * Criar ou abrir conversa (DISCIPLINA ou DIRECT)
 */
export const createThread = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tipo, disciplinaId, targetUserId } = req.body;
    const thread = await chatService.createOrGetThread(req, {
      tipo,
      disciplinaId,
      targetUserId,
    });
    res.status(201).json(thread);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /chat/threads/:id/messages
 * Buscar mensagens com paginação cursor
 */
export const getMessages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { cursor, limit } = req.query;
    const messages = await chatService.getMessages(
      req,
      id,
      cursor as string | undefined,
      limit ? parseInt(limit as string, 10) : undefined
    );
    res.json(messages);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /chat/threads/:id/messages
 * Enviar mensagem
 */
export const sendMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { content, attachments } = req.body;
    const message = await chatService.sendMessage(req, id, {
      content: content || '',
      attachments,
    });
    res.status(201).json(message);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /chat/threads/:id/read
 * Marcar como lido
 */
export const markAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await chatService.markAsRead(req, id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /chat/unread-count
 * Contagem de mensagens não lidas
 */
export const getUnreadCount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await chatService.getUnreadCount(req);
    res.json({ unreadCount: count });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /chat/available-contacts
 * Lista contatos disponíveis para conversa DIRECT (baseado em RBAC)
 */
export const getAvailableContacts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contacts = await chatService.getAvailableContacts(req);
    res.json(contacts);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /chat/upload
 * Upload de anexos para chat (fotos, PDF, vídeos - estilo WhatsApp)
 */
export const uploadAttachment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = (req as any).file;
    if (!file) {
      return res.status(400).json({ message: 'Nenhum arquivo enviado' });
    }
    const instId = (req as any).user?.instituicaoId || 'default';
    const baseUrl = process.env.API_URL || process.env.BASE_URL || 
      `${req.protocol}://${req.get('host') || 'localhost:3001'}`;
    const url = `${baseUrl.replace(/\/$/, '')}/uploads/chat/${instId}/${file.filename}`;
    res.status(201).json({
      url,
      type: file.mimetype,
      name: file.originalname,
      size: file.size,
    });
  } catch (error) {
    next(error);
  }
};
