import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { UserRole } from '@prisma/client';

/**
 * Valida URL de vídeo para tipo UPLOAD
 * URLs de vídeo upload devem ser fileKey/path (não URLs HTTP diretas)
 */
const validateUploadVideoUrl = (url: string): void => {
  // URLs de upload devem ser fileKey/path, não URLs HTTP
  if (url.startsWith('http://') || url.startsWith('https://')) {
    throw new AppError(
      'Para vídeos tipo UPLOAD, forneça o fileKey/path do arquivo no storage, não uma URL HTTP. Use o endpoint de upload para obter o fileKey correto.',
      400
    );
  }
  
  // Validar formato básico (deve ser path válido)
  if (!url || url.trim().length === 0) {
    throw new AppError('FileKey/path do vídeo não pode ser vazio', 400);
  }
  
  // Prevenir paths relativos perigosos
  if (url.includes('..') || url.startsWith('/')) {
    throw new AppError('FileKey/path do vídeo inválido', 400);
  }
};

/**
 * Valida URL conforme o tipo de vídeo (YOUTUBE, VIMEO, BUNNY)
 * Retorna mensagem de erro ou null se válido
 */
const validateUrlByTipo = (url: string, tipoVideo: string): void => {
  const u = url.trim().toLowerCase();
  if (tipoVideo === 'YOUTUBE') {
    if (!u.includes('youtube.com') && !u.includes('youtu.be')) {
      throw new AppError('URL do YouTube inválida. Use o formato youtube.com/watch?v=... ou youtu.be/...', 400);
    }
  } else if (tipoVideo === 'VIMEO') {
    if (!u.includes('vimeo.com')) {
      throw new AppError('URL do Vimeo inválida. Use o formato vimeo.com/...', 400);
    }
  } else if (tipoVideo === 'BUNNY') {
    if (!u.includes('mediadelivery.net') && !u.includes('b-cdn.net')) {
      throw new AppError(
        'URL do Bunny.net inválida. Use iframe.mediadelivery.net/embed/... ou embed/play/..., ou b-cdn.net para HLS.',
        400
      );
    }
  }
};

/**
 * Listar todas as videoaulas (apenas SUPER_ADMIN, sem filtros)
 * Usado para gestão administrativa
 */
export const getAllAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      throw new AppError('Não autenticado', 401);
    }

    const userRoles = user.roles || [];
    const isSuperAdmin = userRoles.includes('SUPER_ADMIN');

    if (!isSuperAdmin) {
      throw new AppError('Apenas SUPER_ADMIN pode acessar todas as videoaulas', 403);
    }

    // Retornar TODAS as videoaulas sem filtros (incluindo inativas)
    const videoAulas = await prisma.videoAula.findMany({
      orderBy: [
        { modulo: 'asc' },
        { ordem: 'asc' },
        { titulo: 'asc' }
      ]
    });

    res.json(videoAulas);
  } catch (error) {
    next(error);
  }
};

/**
 * Verifica se o usuário tem acesso à videoaula pelo perfil
 * perfilAlvo: ADMIN, PROFESSOR, SECRETARIA, ou TODOS
 * TODOS = visível para ADMIN, PROFESSOR, SECRETARIA, DIRECAO, COORDENADOR
 */
const userMatchesPerfil = (perfilAlvo: string | null, userRoles: string[]): boolean => {
  const roles = userRoles.map((r: any) => (typeof r === 'string' ? r : (r as any).role || (r as any).name) || '').filter(Boolean);
  const perfisTreinamento = ['ADMIN', 'PROFESSOR', 'SECRETARIA', 'DIRECAO', 'COORDENADOR', 'SUPER_ADMIN'];
  const userTemPerfilTreinamento = roles.some((r) => perfisTreinamento.includes(r));
  if (!perfilAlvo || perfilAlvo === 'TODOS') {
    return userTemPerfilTreinamento;
  }
  return roles.includes(perfilAlvo);
};

/**
 * Listar videoaulas (filtrado por perfil e tipo de instituição do usuário)
 * Público para ADMIN, PROFESSOR, SECRETARIA - ensino secundário e superior
 */
export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      throw new AppError('Não autenticado', 401);
    }

    const userRoles = user.roles || [];

    // Videoaulas do super-admin são visíveis para todas as instituições
    // Filtro apenas por ativo e perfilAlvo (tipoInstituicao removido para garantir visibilidade)
    const where: any = {
      ativo: true,
    };

    const videoAulas = await prisma.videoAula.findMany({
      where,
      orderBy: [
        { modulo: 'asc' },
        { ordem: 'asc' },
        { titulo: 'asc' }
      ]
    });

    // Filtrar por perfil no aplicativo (perfilAlvo pode ser TODOS ou role específico)
    const filtered = videoAulas.filter((v) => userMatchesPerfil(v.perfilAlvo, userRoles));

    res.json(filtered);
  } catch (error) {
    next(error);
  }
};

/**
 * Criar videoaula (apenas SUPER_ADMIN)
 */
export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      throw new AppError('Não autenticado', 401);
    }

    const userRoles = user.roles || [];
    const isSuperAdmin = userRoles.includes('SUPER_ADMIN');

    if (!isSuperAdmin) {
      throw new AppError('Apenas SUPER_ADMIN pode criar videoaulas', 403);
    }

    const {
      titulo,
      descricao,
      urlVideo,
      tipoVideo,
      modulo,
      perfilAlvo,
      tipoInstituicao,
      ordem,
      ativo
    } = req.body;

    // Validações
    if (!titulo || !titulo.trim()) {
      throw new AppError('Título é obrigatório', 400);
    }

    if (!urlVideo || !urlVideo.trim()) {
      throw new AppError('URL do vídeo é obrigatória', 400);
    }

    // Validação específica por tipo de vídeo
    const tipoVideoFinal = tipoVideo || 'YOUTUBE';
    if (tipoVideoFinal === 'UPLOAD') {
      validateUploadVideoUrl(urlVideo.trim());
    } else {
      validateUrlByTipo(urlVideo.trim(), tipoVideoFinal);
    }

    const perfilAlvoFinal = (perfilAlvo && String(perfilAlvo).trim()) || 'ADMIN';
    const videoAula = await prisma.videoAula.create({
      data: {
        titulo: titulo.trim(),
        descricao: descricao?.trim() || null,
        urlVideo: urlVideo.trim(),
        tipoVideo: tipoVideo || 'YOUTUBE',
        modulo: modulo || 'GERAL',
        perfilAlvo: perfilAlvoFinal,
        tipoInstituicao: tipoInstituicao || null,
        ordem: ordem || 0,
        ativo: ativo !== undefined ? ativo : true
      }
    });

    res.status(201).json(videoAula);
  } catch (error) {
    next(error);
  }
};

/**
 * Atualizar videoaula (apenas SUPER_ADMIN)
 */
export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      throw new AppError('Não autenticado', 401);
    }

    const userRoles = user.roles || [];
    const isSuperAdmin = userRoles.includes('SUPER_ADMIN');

    if (!isSuperAdmin) {
      throw new AppError('Apenas SUPER_ADMIN pode atualizar videoaulas', 403);
    }

    const { id } = req.params;
    const {
      titulo,
      descricao,
      urlVideo,
      tipoVideo,
      modulo,
      perfilAlvo,
      tipoInstituicao,
      ordem,
      ativo
    } = req.body;

    // Verificar se existe
    const existing = await prisma.videoAula.findUnique({
      where: { id }
    });

    if (!existing) {
      throw new AppError('Videoaula não encontrada', 404);
    }

    // Validações
    if (titulo !== undefined && (!titulo || !titulo.trim())) {
      throw new AppError('Título é obrigatório', 400);
    }

    if (urlVideo !== undefined && (!urlVideo || !urlVideo.trim())) {
      throw new AppError('URL do vídeo é obrigatória', 400);
    }

    // Validação específica por tipo de vídeo (quando urlVideo ou tipoVideo é alterado)
    const tipoVideoFinal = tipoVideo !== undefined ? tipoVideo : existing.tipoVideo;
    const urlFinal = urlVideo !== undefined ? urlVideo.trim() : existing.urlVideo;
    if (tipoVideoFinal === 'UPLOAD') {
      if (urlVideo !== undefined) validateUploadVideoUrl(urlFinal);
    } else if (urlVideo !== undefined || tipoVideo !== undefined) {
      validateUrlByTipo(urlFinal, tipoVideoFinal);
    }

    const videoAula = await prisma.videoAula.update({
      where: { id },
      data: {
        ...(titulo !== undefined && { titulo: titulo.trim() }),
        ...(descricao !== undefined && { descricao: descricao?.trim() || null }),
        ...(urlVideo !== undefined && { urlVideo: urlVideo.trim() }),
        ...(tipoVideo !== undefined && { tipoVideo }),
        ...(modulo !== undefined && { modulo }),
        ...(perfilAlvo !== undefined && { perfilAlvo: (perfilAlvo ? String(perfilAlvo) : 'ADMIN') }),
        ...(tipoInstituicao !== undefined && { tipoInstituicao: tipoInstituicao || null }),
        ...(ordem !== undefined && { ordem }),
        ...(ativo !== undefined && { ativo })
      }
    });

    res.json(videoAula);
  } catch (error) {
    next(error);
  }
};

/**
 * Deletar videoaula (apenas SUPER_ADMIN)
 */
export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      throw new AppError('Não autenticado', 401);
    }

    const userRoles = user.roles || [];
    const isSuperAdmin = userRoles.includes('SUPER_ADMIN');

    if (!isSuperAdmin) {
      throw new AppError('Apenas SUPER_ADMIN pode deletar videoaulas', 403);
    }

    const { id } = req.params;

    // Verificar se existe
    const existing = await prisma.videoAula.findUnique({
      where: { id }
    });

    if (!existing) {
      throw new AppError('Videoaula não encontrada', 404);
    }

    await prisma.videoAula.delete({
      where: { id }
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * Obter videoaula por ID (verifica acesso por perfil e tipo instituição)
 */
export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      throw new AppError('Não autenticado', 401);
    }

    const { id } = req.params;

    const videoAula = await prisma.videoAula.findUnique({
      where: { id }
    });

    if (!videoAula) {
      throw new AppError('Videoaula não encontrada', 404);
    }

    if (!videoAula.ativo) {
      throw new AppError('Videoaula não está ativa', 404);
    }

    // Verificar se usuário tem acesso (perfil e tipo instituição)
    const userRoles = user.roles || [];
    if (!userMatchesPerfil(videoAula.perfilAlvo, userRoles)) {
      throw new AppError('Acesso negado a esta videoaula', 403);
    }

    let tipoInstituicao: 'SECUNDARIO' | 'SUPERIOR' | null = null;
    if (user.instituicaoId) {
      const instituicao = await prisma.instituicao.findUnique({
        where: { id: user.instituicaoId },
        select: { tipoAcademico: true }
      });
      tipoInstituicao = instituicao?.tipoAcademico || null;
    }
    const tipoOk = !videoAula.tipoInstituicao || videoAula.tipoInstituicao === tipoInstituicao;
    if (!tipoOk) {
      throw new AppError('Acesso negado a esta videoaula', 403);
    }

    res.json(videoAula);
  } catch (error) {
    next(error);
  }
};

/**
 * Obter signed URL para vídeo tipo UPLOAD
 * Retorna URL assinada temporária para playback seguro
 */
export const getVideoSignedUrl = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      throw new AppError('Não autenticado', 401);
    }

    const { id } = req.params;

    const videoAula = await prisma.videoAula.findUnique({
      where: { id }
    });

    if (!videoAula) {
      throw new AppError('Videoaula não encontrada', 404);
    }

    if (!videoAula.ativo) {
      throw new AppError('Videoaula não está ativa', 404);
    }

    const userRoles = user.roles || [];
    if (!userMatchesPerfil(videoAula.perfilAlvo, userRoles)) {
      throw new AppError('Acesso negado a esta videoaula', 403);
    }

    let tipoInstituicao: 'SECUNDARIO' | 'SUPERIOR' | null = null;
    if (user.instituicaoId) {
      const instituicao = await prisma.instituicao.findUnique({
        where: { id: user.instituicaoId },
        select: { tipoAcademico: true }
      });
      tipoInstituicao = instituicao?.tipoAcademico || null;
    }
    const tipoOk = !videoAula.tipoInstituicao || videoAula.tipoInstituicao === tipoInstituicao;
    if (!tipoOk) {
      throw new AppError('Acesso negado a esta videoaula', 403);
    }

    // Apenas vídeos tipo UPLOAD precisam de signed URL
    if (videoAula.tipoVideo !== 'UPLOAD') {
      throw new AppError('Signed URL disponível apenas para vídeos tipo UPLOAD', 400);
    }

    // Gerar signed URL usando a mesma lógica do storage controller
    const baseUrl = process.env.API_URL || process.env.BASE_URL || 
      `${req.protocol}://${req.get('host')}`;
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : '';
    const encodedPath = encodeURIComponent(videoAula.urlVideo);
    const encodedToken = encodeURIComponent(token);
    
    const { SIGNED_URL_EXPIRATION_MS } = await import('../constants/storage.js');
    const expiresAt = Date.now() + SIGNED_URL_EXPIRATION_MS;
    const signedUrl = `${cleanBaseUrl}/storage/file/videoaulas?path=${encodedPath}&token=${encodedToken}&signed=true&expires=${expiresAt}`;

    res.json({ url: signedUrl });
  } catch (error) {
    next(error);
  }
};
