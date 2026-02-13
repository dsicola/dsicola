import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, AuthenticatedRequest } from '../middlewares/auth.js';
import path from 'path';
import fs from 'fs';
import { UserRole } from '@prisma/client';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { alunoId } = req.query;
    const filter = addInstitutionFilter(req);
    const userRoles = req.user?.roles || [];

    // SEGURANÇA: ALUNO só pode ver próprios documentos
    let effectiveAlunoId = alunoId as string | undefined;
    if (userRoles.includes('ALUNO') && !userRoles.includes('ADMIN') && !userRoles.includes('SECRETARIA')) {
      effectiveAlunoId = req.user?.userId;
    }

    // Build where clause
    let where: any = {};

    // Filter by alunoId if provided
    if (effectiveAlunoId) {
      where.alunoId = effectiveAlunoId;
    }

    // Multi-tenant filtering: filter by alunos from the institution
    if (filter.instituicaoId) {
      // Get all alunos from this institution
      const alunosDaInstituicao = await prisma.user.findMany({
        where: { instituicaoId: filter.instituicaoId },
        select: { id: true },
      });
      const alunoIds = alunosDaInstituicao.map(a => a.id);
      
      if (alunoIds.length === 0) {
        return res.json([]);
      }
      
      // If alunoId was provided, verify it belongs to the institution
      if (effectiveAlunoId && !alunoIds.includes(effectiveAlunoId)) {
        return res.json([]);
      }

      // Filter by alunoIds from the institution
      where.alunoId = effectiveAlunoId ? { equals: effectiveAlunoId } : { in: alunoIds };
    }
    
    const documentos = await prisma.documentoAluno.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    
    // Convert to snake_case for frontend compatibility
    const documentosFormatted = documentos.map(doc => ({
      id: doc.id,
      aluno_id: doc.alunoId,
      alunoId: doc.alunoId,
      tipo_documento: doc.tipoDocumento,
      tipoDocumento: doc.tipoDocumento,
      nome_arquivo: doc.nomeArquivo,
      nomeArquivo: doc.nomeArquivo,
      arquivo_url: doc.arquivoUrl,
      arquivoUrl: doc.arquivoUrl,
      tamanho_bytes: doc.tamanhoBytes,
      tamanhoBytes: doc.tamanhoBytes,
      descricao: doc.descricao,
      uploaded_by: doc.uploadedBy,
      uploadedBy: doc.uploadedBy,
      created_at: doc.createdAt,
      createdAt: doc.createdAt,
      updated_at: doc.updatedAt,
      updatedAt: doc.updatedAt,
    }));
    
    res.json(documentosFormatted);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    const userRoles = req.user?.roles || [];

    const documento = await prisma.documentoAluno.findUnique({
      where: { id },
    });

    if (!documento) {
      throw new AppError('Documento não encontrado', 404);
    }

    // SEGURANÇA: ALUNO só pode ver próprios documentos
    if (userRoles.includes('ALUNO') && !userRoles.includes('ADMIN') && !userRoles.includes('SECRETARIA')) {
      if (documento.alunoId !== req.user?.userId) {
        throw new AppError('Documento não encontrado', 404);
      }
    }

    // Multi-tenant check: verify the aluno belongs to the institution
    if (filter.instituicaoId) {
      const aluno = await prisma.user.findUnique({
        where: { id: documento.alunoId },
        select: { instituicaoId: true },
      });
      
      if (!aluno || aluno.instituicaoId !== filter.instituicaoId) {
        throw new AppError('Documento não encontrado', 404);
      }
    }
    
    // Convert to snake_case for frontend compatibility
    const documentoFormatted = {
      id: documento.id,
      aluno_id: documento.alunoId,
      alunoId: documento.alunoId,
      tipo_documento: documento.tipoDocumento,
      tipoDocumento: documento.tipoDocumento,
      nome_arquivo: documento.nomeArquivo,
      nomeArquivo: documento.nomeArquivo,
      arquivo_url: documento.arquivoUrl,
      arquivoUrl: documento.arquivoUrl,
      tamanho_bytes: documento.tamanhoBytes,
      tamanhoBytes: documento.tamanhoBytes,
      descricao: documento.descricao,
      uploaded_by: documento.uploadedBy,
      uploadedBy: documento.uploadedBy,
      created_at: documento.createdAt,
      createdAt: documento.createdAt,
      updated_at: documento.updatedAt,
      updatedAt: documento.updatedAt,
    };
    
    res.json(documentoFormatted);
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body;
    
    // Convert snake_case to camelCase for Prisma
    const data = {
      alunoId: body.alunoId || body.aluno_id,
      tipoDocumento: body.tipoDocumento || body.tipo_documento,
      nomeArquivo: body.nomeArquivo || body.nome_arquivo,
      arquivoUrl: body.arquivoUrl || body.arquivo_url,
      tamanhoBytes: body.tamanhoBytes || body.tamanho_bytes,
      descricao: body.descricao || null,
      uploadedBy: body.uploadedBy || body.uploaded_by || null,
    };
    
    const documento = await prisma.documentoAluno.create({ data });
    
    // Convert back to snake_case for frontend
    const documentoFormatted = {
      id: documento.id,
      aluno_id: documento.alunoId,
      alunoId: documento.alunoId,
      tipo_documento: documento.tipoDocumento,
      tipoDocumento: documento.tipoDocumento,
      nome_arquivo: documento.nomeArquivo,
      nomeArquivo: documento.nomeArquivo,
      arquivo_url: documento.arquivoUrl,
      arquivoUrl: documento.arquivoUrl,
      tamanho_bytes: documento.tamanhoBytes,
      tamanhoBytes: documento.tamanhoBytes,
      descricao: documento.descricao,
      uploaded_by: documento.uploadedBy,
      uploadedBy: documento.uploadedBy,
      created_at: documento.createdAt,
      createdAt: documento.createdAt,
      updated_at: documento.updatedAt,
      updatedAt: documento.updatedAt,
    };
    
    res.status(201).json(documentoFormatted);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await prisma.documentoAluno.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// Get signed URL for document file
export const getArquivoSignedUrl = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    // Find the document
    const documento = await prisma.documentoAluno.findUnique({
      where: { id },
      include: {
        aluno: {
          select: {
            id: true,
            instituicaoId: true,
          },
        },
      },
    });
    
    if (!documento) {
      throw new AppError('Documento não encontrado', 404);
    }
    
    // Check permissions (same as getArquivo)
    const isAluno = req.user?.roles.includes(UserRole.ALUNO);
    const isAdmin = req.user?.roles.some(role => 
      [UserRole.ADMIN, UserRole.SECRETARIA, UserRole.SUPER_ADMIN].includes(role)
    );
    
    if (isAluno && !isAdmin) {
      if (documento.alunoId !== req.user?.userId) {
        throw new AppError('Acesso negado: você só pode visualizar seus próprios documentos', 403);
      }
    }
    
    // Multi-tenant check
    if (filter.instituicaoId) {
      if (!documento.aluno.instituicaoId || documento.aluno.instituicaoId !== filter.instituicaoId) {
        throw new AppError('Documento não encontrado', 404);
      }
    }
    
    // Get base URL
    let baseUrl = process.env.API_URL || process.env.BASE_URL;
    if (!baseUrl) {
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.headers.host || 'localhost:3001';
      baseUrl = `${protocol}://${host}`;
    }
    baseUrl = baseUrl.replace(/\/$/, '');
    
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : '';
    
    // Construct signed URL with token in query string
    const encodedToken = encodeURIComponent(token);
    const signedUrl = `${baseUrl}/documentos-aluno/${id}/arquivo?token=${encodedToken}`;
    
    res.json({ url: signedUrl });
  } catch (error) {
    next(error);
  }
};

// Get file for a document - serves the actual file with permission checks
export const getArquivo = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    // Find the document
    const documento = await prisma.documentoAluno.findUnique({
      where: { id },
      include: {
        aluno: {
          select: {
            id: true,
            instituicaoId: true,
          },
        },
      },
    });
    
    if (!documento) {
      throw new AppError('Documento não encontrado', 404);
    }
    
    // Check permissions:
    // - ALUNO can only see their own documents
    // - ADMIN, SECRETARIA, SUPER_ADMIN can see all documents
    const isAluno = req.user?.roles.includes(UserRole.ALUNO);
    const isAdmin = req.user?.roles.some(role => 
      [UserRole.ADMIN, UserRole.SECRETARIA, UserRole.SUPER_ADMIN].includes(role)
    );
    
    if (isAluno && !isAdmin) {
      // Aluno can only see their own documents
      if (documento.alunoId !== req.user?.userId) {
        throw new AppError('Acesso negado: você só pode visualizar seus próprios documentos', 403);
      }
    }
    
    // Multi-tenant check: verify the aluno belongs to the institution
    if (filter.instituicaoId) {
      if (!documento.aluno.instituicaoId || documento.aluno.instituicaoId !== filter.instituicaoId) {
        throw new AppError('Documento não encontrado', 404);
      }
    }
    
    // Get file path from arquivoUrl
    // arquivoUrl format: path relative to bucket (e.g., "alunoId/timestamp_filename.pdf")
    const filePath = documento.arquivoUrl;
    
    if (!filePath) {
      throw new AppError('Arquivo não encontrado', 404);
    }
    
    // Serve from local filesystem (works in both development and production)
    // In the future, this can be extended to support cloud storage (S3, GCS, etc.)
    
    // Prevent directory traversal attacks
    if (filePath.includes('..') || filePath.startsWith('/')) {
      throw new AppError('Caminho de arquivo inválido', 400);
    }
    
    // Construct full path
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const bucketDir = path.join(uploadsDir, 'documentos_alunos');
    const fullPath = path.join(bucketDir, filePath);
    
    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      throw new AppError('Arquivo não encontrado no sistema de arquivos', 404);
    }
    
    // Get file stats
    const stats = fs.statSync(fullPath);
    if (!stats.isFile()) {
      throw new AppError('Caminho não é um arquivo válido', 400);
    }
    
    // Determine content type based on file extension
    const ext = path.extname(fullPath).toLowerCase();
    const contentTypes: { [key: string]: string } = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
    
    const contentType = contentTypes[ext] || 'application/octet-stream';
    
    // Check if download is requested (via query parameter)
    const download = req.query.download === 'true' || req.query.download === '1';
    
    // Set headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Disposition', download 
      ? `attachment; filename="${documento.nomeArquivo}"`
      : `inline; filename="${documento.nomeArquivo}"`);
    
    // Stream the file
    const fileStream = fs.createReadStream(fullPath);
    fileStream.pipe(res);
    
    fileStream.on('error', (error) => {
      next(new AppError('Erro ao ler arquivo', 500));
    });
  } catch (error) {
    next(error);
  }
};
