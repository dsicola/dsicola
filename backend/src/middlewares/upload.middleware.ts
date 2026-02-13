import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';

/**
 * ========================================
 * MIDDLEWARE DE UPLOAD - BIBLIOTECA
 * ========================================
 * 
 * Configuração do multer para upload de PDFs
 */

// Criar diretório de uploads se não existir
const uploadsDir = path.join(process.cwd(), 'uploads', 'biblioteca');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Criar diretório de thumbnails se não existir
const thumbnailsDir = path.join(process.cwd(), 'uploads', 'biblioteca', 'thumbnails');
if (!fs.existsSync(thumbnailsDir)) {
  fs.mkdirSync(thumbnailsDir, { recursive: true });
}

/**
 * Configuração de storage do multer
 * Salva arquivos em /uploads/biblioteca ou /uploads/biblioteca/thumbnails conforme o campo
 */
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    // Se for thumbnail, salvar em pasta de thumbnails
    if (file.fieldname === 'thumbnail') {
      cb(null, thumbnailsDir);
    } else {
      cb(null, uploadsDir);
    }
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname);
    
    if (file.fieldname === 'thumbnail') {
      // Thumbnail: thumb-timestamp-random.jpg/png
      const filename = `thumb-${uniqueSuffix}${ext}`;
      cb(null, filename);
    } else {
      // PDF: nome-timestamp-random.pdf
      const name = path.basename(file.originalname, ext);
      const filename = `${name}-${uniqueSuffix}${ext}`;
      cb(null, filename);
    }
  },
});

/**
 * Filtro de arquivos - aceita PDF para campo 'arquivo' e imagem para campo 'thumbnail'
 */
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const fieldname = file.fieldname;
  
  if (fieldname === 'arquivo') {
    // Validar PDF
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.pdf') {
      return cb(new AppError('Apenas arquivos PDF são permitidos para o campo arquivo', 400));
    }
    if (file.mimetype !== 'application/pdf') {
      return cb(new AppError('Tipo de arquivo inválido. Apenas PDF é permitido', 400));
    }
    // Validar tamanho máximo para PDF (50MB)
    if (file.size > 50 * 1024 * 1024) {
      return cb(new AppError('Arquivo PDF muito grande. Tamanho máximo: 50MB', 400));
    }
  } else if (fieldname === 'thumbnail') {
    // Validar imagem
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.jpg', '.jpeg', '.png'];
    if (!allowedExts.includes(ext)) {
      return cb(new AppError('Apenas imagens JPG ou PNG são permitidas para thumbnail', 400));
    }
    if (!file.mimetype.startsWith('image/')) {
      return cb(new AppError('Tipo de arquivo inválido. Apenas imagens são permitidas', 400));
    }
    // Validar tamanho máximo para thumbnail (2MB)
    if (file.size > 2 * 1024 * 1024) {
      return cb(new AppError('Imagem muito grande. Tamanho máximo: 2MB', 400));
    }
  }
  
  cb(null, true);
};

/**
 * Configuração do multer para PDFs
 * Aceita campo 'arquivo' (PDF) e permite campos de texto adicionais
 */
export const uploadBiblioteca = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB máximo
    fields: 20, // Permitir até 20 campos de texto
  },
});

/**
 * Middleware para validar se arquivo foi enviado quando tipo = DIGITAL
 * Funciona com .fields() do multer (req.files)
 */
export const validateDigitalFile = (req: Request, res: Response, next: NextFunction) => {
  const tipo = req.body.tipo;
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const arquivo = files?.['arquivo']?.[0];

  if (tipo === 'DIGITAL' && !arquivo) {
    return next(new AppError('Arquivo PDF é obrigatório para itens digitais', 400));
  }

  if (tipo === 'FISICO' && arquivo) {
    // Deletar arquivo enviado se tipo não for DIGITAL
    try {
      fs.unlinkSync(arquivo.path);
    } catch (error) {
      console.warn('Erro ao deletar arquivo:', error);
    }
    return next(new AppError('Upload de arquivo não permitido para itens físicos', 400));
  }

  next();
};

/**
 * ========================================
 * MIDDLEWARE DE UPLOAD - BACKUP
 * ========================================
 * 
 * Configuração do multer para upload de arquivos de backup (JSON)
 */

// Criar diretório de uploads de backup se não existir
const backupUploadsDir = path.join(process.cwd(), 'uploads', 'backups_temp');
if (!fs.existsSync(backupUploadsDir)) {
  fs.mkdirSync(backupUploadsDir, { recursive: true });
}

/**
 * Configuração de storage do multer para backups
 */
const backupStorage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    cb(null, backupUploadsDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname);
    const filename = `backup_upload_${uniqueSuffix}${ext}`;
    cb(null, filename);
  },
});

/**
 * Filtro de arquivos para backup - aceita apenas JSON
 */
const backupFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext !== '.json') {
    return cb(new AppError('Apenas arquivos JSON são permitidos para upload de backup', 400));
  }
  if (file.mimetype !== 'application/json' && !file.mimetype.includes('json')) {
    return cb(new AppError('Tipo de arquivo inválido. Apenas JSON é permitido', 400));
  }
  // Nota: validação de tamanho é feita no limits do multer (500MB)
  cb(null, true);
};

/**
 * Configuração do multer para upload de backups (JSON)
 */
export const uploadBackup = multer({
  storage: backupStorage,
  fileFilter: backupFileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB máximo
    fields: 10, // Permitir alguns campos de texto
  },
});

