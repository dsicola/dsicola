/**
 * Testes: Segurança do Storage de Documentos
 *
 * Valida que BUCKET_UPLOAD_ROLES está configurado corretamente e que
 * documentos sensíveis exigem roles específicas.
 *
 * Execute: npx vitest run src/__tests__/storage-documentos-seguranca.test.ts
 */
import { describe, it, expect } from 'vitest';
import { BUCKET_UPLOAD_ROLES, isAllowedReadUploadBucket } from '../constants/storage.js';

describe('Storage Documentos - Segurança', () => {
  it('1. Buckets de documentos exigem roles específicas', () => {
    expect(BUCKET_UPLOAD_ROLES.documentos_funcionarios).toBeDefined();
    expect(BUCKET_UPLOAD_ROLES.documentos_funcionarios).toContain('ADMIN');
    expect(BUCKET_UPLOAD_ROLES.documentos_funcionarios).toContain('SUPER_ADMIN');
    expect(BUCKET_UPLOAD_ROLES.documentos_funcionarios).toContain('RH');
    expect(BUCKET_UPLOAD_ROLES.documentos_funcionarios).not.toContain('ALUNO');
    expect(BUCKET_UPLOAD_ROLES.documentos_funcionarios).not.toContain('PROFESSOR');

    expect(BUCKET_UPLOAD_ROLES.documentos_alunos).toBeDefined();
    expect(BUCKET_UPLOAD_ROLES.documentos_alunos).toContain('ADMIN');
    expect(BUCKET_UPLOAD_ROLES.documentos_alunos).toContain('SECRETARIA');
    expect(BUCKET_UPLOAD_ROLES.documentos_alunos).toContain('SUPER_ADMIN');
    expect(BUCKET_UPLOAD_ROLES.documentos_alunos).not.toContain('ALUNO');
  });

  it('2. ALUNO não pode upload em documentos_alunos', () => {
    const allowed = BUCKET_UPLOAD_ROLES.documentos_alunos;
    expect(allowed).not.toContain('ALUNO');
  });

  it('3. PROFESSOR não pode upload em documentos_funcionarios', () => {
    const allowed = BUCKET_UPLOAD_ROLES.documentos_funcionarios;
    expect(allowed).not.toContain('PROFESSOR');
  });

  it('4. ADMIN pode upload em ambos os buckets de documentos', () => {
    expect(BUCKET_UPLOAD_ROLES.documentos_alunos).toContain('ADMIN');
    expect(BUCKET_UPLOAD_ROLES.documentos_funcionarios).toContain('ADMIN');
  });

  it('5. Bucket desconhecido não está na whitelist', () => {
    expect(BUCKET_UPLOAD_ROLES['bucket_inexistente']).toBeUndefined();
    expect(BUCKET_UPLOAD_ROLES['']).toBeUndefined();
  });

  it('6. Buckets documentados: avatars, comprovativos, videoaulas', () => {
    expect(BUCKET_UPLOAD_ROLES.avatars).toBeDefined();
    expect(BUCKET_UPLOAD_ROLES.comprovativos).toBeDefined();
    expect(BUCKET_UPLOAD_ROLES.videoaulas).toBeDefined();
  });

  it('7. Leitura /uploads só em buckets conhecidos (incl. biblioteca, chat, comunicados, relatorios)', () => {
    expect(isAllowedReadUploadBucket('documentos_alunos')).toBe(true);
    expect(isAllowedReadUploadBucket('biblioteca')).toBe(true);
    expect(isAllowedReadUploadBucket('chat')).toBe(true);
    expect(isAllowedReadUploadBucket('comunicados')).toBe(true);
    expect(isAllowedReadUploadBucket('relatorios')).toBe(true);
    expect(isAllowedReadUploadBucket('etc')).toBe(false);
    expect(isAllowedReadUploadBucket('../x')).toBe(false);
  });
});
