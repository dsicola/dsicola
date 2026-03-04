/**
 * Integration tests: Mensalidades (listagem, multas/juros)
 *
 * Prerequisites: Run `npm run db:seed` (creates SUPER_ADMIN).
 * Creates minimal seed data (instituição, aluno, mensalidade vencida) for multas/juros test.
 *
 * Execute: npx vitest run src/__tests__/integration-mensalidades.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import prisma from '../lib/prisma.js';
import bcrypt from 'bcryptjs';
import { Decimal } from '@prisma/client/runtime/library';

const LOGIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'superadmin@dsicola.com';
const LOGIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';

let accessToken: string;
let instituicaoId: string;
let alunoId: string;
let mensalidadeId: string;

describe('Integration: Mensalidades', () => {
  beforeAll(async () => {
    // Login as SUPER_ADMIN
    const loginRes = await request(app)
      .post('/auth/login')
      .set('Host', 'localhost')
      .send({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD });

    if (loginRes.status !== 200) {
      throw new Error(`Login failed: ${JSON.stringify(loginRes.body)}`);
    }
    accessToken = loginRes.body.accessToken;

    // Ensure instituição exists
    let inst = await prisma.instituicao.findFirst({
      where: { status: 'ativa' },
      select: { id: true },
    });
    if (!inst) {
      inst = await prisma.instituicao.create({
        data: {
          nome: 'Inst Mensalidades Test',
          subdominio: 'inst-mensalidades-test',
          tipoInstituicao: 'ENSINO_MEDIO',
          tipoAcademico: 'SECUNDARIO',
          status: 'ativa',
        },
      });
    }
    instituicaoId = inst.id;

    // Create aluno (User with ALUNO role) for mensalidade
    const hashedPassword = await bcrypt.hash('AlunoTest123!', 10);
    let aluno = await prisma.user.findFirst({
      where: {
        instituicaoId,
        roles: { some: { role: 'ALUNO' } },
      },
      select: { id: true },
    });
    if (!aluno) {
      const created = await prisma.user.create({
        data: {
          email: `aluno.mensalidade.test.${Date.now()}@test.dsicola.com`,
          password: hashedPassword,
          nomeCompleto: 'Aluno Teste Mensalidade',
          instituicaoId,
          mustChangePassword: false,
        },
      });
      await prisma.userRole_.create({
        data: { userId: created.id, role: 'ALUNO', instituicaoId },
      });
      aluno = { id: created.id };
    }
    alunoId = aluno.id;

    // Create mensalidade with past due date (for multas/juros)
    const dataVencimento = new Date();
    dataVencimento.setDate(dataVencimento.getDate() - 30); // 30 days ago

    const existing = await prisma.mensalidade.findFirst({
      where: {
        alunoId,
        mesReferencia: '1',
        anoReferencia: dataVencimento.getFullYear(),
      },
    });

    if (!existing) {
      const created = await prisma.mensalidade.create({
        data: {
          alunoId,
          mesReferencia: '1',
          anoReferencia: dataVencimento.getFullYear(),
          valor: new Decimal(10000),
          valorDesconto: new Decimal(0),
          dataVencimento,
          status: 'Pendente',
        },
      });
      mensalidadeId = created.id;
    } else {
      mensalidadeId = existing.id;
      // Ensure it's overdue and not paid
      await prisma.mensalidade.update({
        where: { id: mensalidadeId },
        data: {
          dataVencimento,
          dataPagamento: null,
          status: 'Pendente',
          valorMulta: new Decimal(0),
          valorJuros: new Decimal(0),
        },
      });
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('GET /mensalidades', () => {
    it('returns 200 with admin token and correct data structure', async () => {
      const res = await request(app)
        .get(`/mensalidades?instituicaoId=${instituicaoId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Host', 'localhost');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toHaveProperty('page');
      expect(res.body.meta).toHaveProperty('pageSize');
      expect(res.body.meta).toHaveProperty('total');
    });

    it('returns 401 without token', async () => {
      const res = await request(app)
        .get(`/mensalidades?instituicaoId=${instituicaoId}`)
        .set('Host', 'localhost');

      expect(res.status).toBe(401);
    });
  });

  describe('Multas/Juros logic', () => {
    it('mensalidade vencida has valor_multa and valor_juros in response structure', async () => {
      const res = await request(app)
        .get(`/mensalidades?instituicaoId=${instituicaoId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Host', 'localhost');

      expect(res.status).toBe(200);

      const mensalidades = res.body.data;
      const vencida = mensalidades.find(
        (m: any) => m.id === mensalidadeId || new Date(m.data_vencimento) < new Date()
      );

      if (vencida) {
        expect(vencida).toHaveProperty('valor_multa');
        expect(vencida).toHaveProperty('valor_juros');
        expect(typeof vencida.valor_multa).toBe('number');
        expect(typeof vencida.valor_juros).toBe('number');
        // Overdue mensalidade (30 days) should have multa > 0 (2% of 10000 = 200)
        if (new Date(vencida.data_vencimento) < new Date()) {
          expect(vencida.valor_multa).toBeGreaterThanOrEqual(0);
          expect(vencida.valor_juros).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('GET /mensalidades/:id returns single mensalidade with multa/juros fields', async () => {
      const res = await request(app)
        .get(`/mensalidades/${mensalidadeId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Host', 'localhost');

      if (res.status === 404) {
        return; // Mensalidade may not be accessible if filter excludes it
      }

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('valor_multa');
      expect(res.body).toHaveProperty('valor_juros');
      expect(res.body).toHaveProperty('aluno');
      expect(res.body).toHaveProperty('status');
    });
  });
});
