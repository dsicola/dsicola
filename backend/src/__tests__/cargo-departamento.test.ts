/**
 * Testes unitários das regras de negócio: cargo e departamento (validações).
 * Alinhado ao ROADMAP-100 — testes unitários em regras críticas.
 *
 * Execute: npx vitest run src/__tests__/cargo-departamento.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  isUsuarioInterno,
  isAluno,
  validarObrigatoriedadeCargoDepartamento,
} from '../services/cargo-departamento.service.js';

describe('isUsuarioInterno', () => {
  it('retorna true para ADMIN', () => {
    expect(isUsuarioInterno(['ADMIN'])).toBe(true);
  });

  it('retorna true para PROFESSOR', () => {
    expect(isUsuarioInterno(['PROFESSOR'])).toBe(true);
  });

  it('retorna false para apenas ALUNO', () => {
    expect(isUsuarioInterno(['ALUNO'])).toBe(false);
  });

  it('retorna false para array vazio', () => {
    expect(isUsuarioInterno([])).toBe(false);
  });
});

describe('isAluno', () => {
  it('retorna true quando ALUNO está nos roles', () => {
    expect(isAluno(['ALUNO'])).toBe(true);
  });

  it('retorna false quando ALUNO não está nos roles', () => {
    expect(isAluno(['ADMIN'])).toBe(false);
  });
});

describe('validarObrigatoriedadeCargoDepartamento', () => {
  it('não lança para aluno (isentos)', () => {
    expect(() =>
      validarObrigatoriedadeCargoDepartamento(null, null, ['ALUNO'])
    ).not.toThrow();
  });

  it('lança quando interno sem cargo', () => {
    expect(() =>
      validarObrigatoriedadeCargoDepartamento(null, 'dept-1', ['PROFESSOR'])
    ).toThrow(/Cargo é obrigatório/);
  });

  it('lança quando interno sem departamento', () => {
    expect(() =>
      validarObrigatoriedadeCargoDepartamento('cargo-1', null, ['SECRETARIA'])
    ).toThrow(/Departamento é obrigatório/);
  });

  it('não lança quando interno tem cargo e departamento', () => {
    expect(() =>
      validarObrigatoriedadeCargoDepartamento('cargo-1', 'dept-1', ['ADMIN'])
    ).not.toThrow();
  });
});
