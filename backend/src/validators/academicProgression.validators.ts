import { z } from 'zod';

export const matriculaAnualIdSchema = z.object({
  matriculaAnualId: z.string().uuid(),
});

export const classeIdParamSchema = z.object({
  classeId: z.string().uuid(),
});

export const simularProgressaoSchema = z.object({
  matriculaAnualId: z.string().uuid(),
  anoLetivoDestinoId: z.string().uuid().optional(),
  overrideSequencial: z.boolean().optional(),
});

export const marcarDesistentesSchema = z.object({
  anoLetivoAnteriorId: z.string().uuid(),
  anoLetivoNovoId: z.string().uuid(),
});

export const taxaAprovacaoSchema = z.object({
  anoLetivoId: z.string().uuid(),
});

export const regraAprovacaoCreateSchema = z.object({
  cursoId: z.string().uuid().nullable().optional(),
  classeId: z.string().uuid().nullable().optional(),
  mediaMinima: z.number().min(0).max(20).nullable().optional(),
  maxReprovacoes: z.number().int().min(0).max(50).nullable().optional(),
  exigeDisciplinasChave: z.boolean().optional(),
});

export const disciplinaChaveCreateSchema = z.object({
  cursoId: z.string().uuid(),
  classeId: z.string().uuid().nullable().optional(),
  disciplinaId: z.string().uuid(),
});
