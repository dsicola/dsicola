#!/usr/bin/env tsx
/**
 * Script para criar termo legal padrão de backup/restore
 * 
 * USO:
 *   tsx scripts/criar-termo-backup-padrao.ts <instituicao_id>
 * 
 * Se não fornecer instituicao_id, cria para todas as instituições ativas
 */

import prisma from '../src/lib/prisma.js';
import { TermoLegalService, TipoAcaoTermoLegal } from '../src/services/termoLegal.service.js';

const TERMO_HTML = `<h1>TERMO DE RESPONSABILIDADE E ACEITE INSTITUCIONAL</h1>

<p>
Este Termo regula o uso de funcionalidades críticas do sistema <strong>DSICOLA</strong>,
plataforma de gestão acadêmica institucional, aplicável a instituições de
<strong>Ensino Superior</strong> e <strong>Ensino Secundário</strong>.
</p>

<h2>1. DAS DEFINIÇÕES</h2>
<p>
Para fins deste Termo:
<ul>
  <li><strong>Sistema</strong>: DSICOLA – Sistema de Gestão Acadêmica</li>
  <li><strong>Instituição</strong>: Entidade educacional cadastrada no sistema</li>
  <li><strong>Usuário</strong>: Pessoa autenticada com perfil institucional válido</li>
  <li><strong>Ação Crítica</strong>: Qualquer operação que impacte dados oficiais, históricos ou legais</li>
</ul>
</p>

<h2>2. DAS AÇÕES CRÍTICAS</h2>
<p>
São consideradas ações críticas, entre outras:
<ul>
  <li>Geração e restauração de backups institucionais</li>
  <li>Encerramento e reabertura de Ano Letivo</li>
  <li>Alterações em históricos acadêmicos</li>
  <li>Emissão de documentos oficiais</li>
</ul>
</p>

<h2>3. DA RESPONSABILIDADE</h2>
<p>
Ao aceitar este Termo, o Usuário declara que:
<ul>
  <li>Possui autorização institucional para executar a ação</li>
  <li>Compreende os impactos acadêmicos, administrativos e legais</li>
  <li>Assume total responsabilidade pelos efeitos da operação</li>
</ul>
</p>

<h2>4. DA AUDITORIA E RASTREABILIDADE</h2>
<p>
Todas as ações são registradas com:
<ul>
  <li>Identificação do usuário</li>
  <li>Instituição vinculada</li>
  <li>Data, hora e endereço IP</li>
  <li>Hash criptográfico do documento de aceite</li>
</ul>
</p>

<h2>5. DA VALIDADE LEGAL</h2>
<p>
Este aceite possui validade legal equivalente à assinatura eletrônica,
nos termos das boas práticas de governança institucional e compliance.
</p>

<h2>6. DISPOSIÇÕES FINAIS</h2>
<p>
Este Termo é parte integrante do uso do sistema DSICOLA.
A continuidade da operação está condicionada à sua aceitação.
</p>

<p>
<strong>Data:</strong> {{DATA}} <br/>
<strong>Usuário:</strong> {{USUARIO}} <br/>
<strong>Perfil:</strong> {{PERFIL}} <br/>
<strong>Instituição:</strong> {{INSTITUICAO}}
</p>`;

async function main() {
  const instituicaoIdArg = process.argv[2];

  console.log('📋 Criando termo legal padrão de backup/restore...\n');

  try {
    let instituicoes;

    if (instituicaoIdArg) {
      // Criar para instituição específica
      const instituicao = await prisma.instituicao.findUnique({
        where: { id: instituicaoIdArg },
        select: { id: true, nome: true },
      });

      if (!instituicao) {
        console.error(`❌ Instituição não encontrada: ${instituicaoIdArg}`);
        process.exit(1);
      }

      instituicoes = [instituicao];
    } else {
      // Criar para todas as instituições ativas
      instituicoes = await prisma.instituicao.findMany({
        where: { status: 'ativa' },
        select: { id: true, nome: true },
      });

      console.log(`📊 Encontradas ${instituicoes.length} instituições ativas\n`);
    }

    let criados = 0;
    let atualizados = 0;

    for (const instituicao of instituicoes) {
      try {
        // Verificar se já existe termo ativo
        const termoExistente = await prisma.termoLegal.findFirst({
          where: {
            instituicaoId: instituicao.id,
            tipoAcao: TipoAcaoTermoLegal.RESTORE_BACKUP,
            ativo: true,
          },
        });

        if (termoExistente) {
          console.log(`⚠️  Instituição "${instituicao.nome}" já possui termo ativo (versão ${termoExistente.versao})`);
          console.log(`   Desativando termo anterior e criando nova versão...`);
          atualizados++;
        } else {
          criados++;
        }

        const resultado = await TermoLegalService.criarOuAtualizarTermo(
          instituicao.id,
          TipoAcaoTermoLegal.RESTORE_BACKUP,
          'Termo de Responsabilidade e Aceite Institucional - Backup e Restore',
          TERMO_HTML
        );

        console.log(`✅ ${instituicao.nome}: Termo criado/atualizado (ID: ${resultado.id}, Versão: ${resultado.versao})`);
      } catch (error) {
        console.error(`❌ Erro ao criar termo para "${instituicao.nome}":`, error);
      }
    }

    console.log(`\n📊 Resumo:`);
    console.log(`   - Termos criados: ${criados}`);
    console.log(`   - Termos atualizados: ${atualizados}`);
    console.log(`   - Total processado: ${instituicoes.length}\n`);

    console.log('✅ Processo concluído!\n');
  } catch (error) {
    console.error('❌ Erro ao criar termos legais:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

