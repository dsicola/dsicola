import { Request } from 'express';
import prisma from '../lib/prisma.js';
import { requireTenantScope } from '../middlewares/auth.js';
import { AuditService } from './audit.service.js';
import { SecurityMonitorService } from './security-monitor.service.js';

/**
 * Tipos de e-mail suportados
 */
export type EmailType = 
  | 'INSTITUICAO_CRIADA'
  | 'CREDENCIAIS_ADMIN'
  | 'CANDIDATURA_APROVADA'
  | 'NOTIFICACAO_GERAL'
  | 'RECUPERACAO_SENHA'
  | 'SENHA_REDEFINIDA'
  | 'ASSINATURA_ATIVADA'
  | 'ASSINATURA_EXPIRADA'
  | 'ASSINATURA_EXPIRANDO'
  | 'CRIACAO_CONTA_FUNCIONARIO'
  | 'CRIACAO_CONTA_ACESSO'
  | 'MATRICULA_ALUNO'
  | 'PLANO_ENSINO_ATRIBUIDO'
  | 'ENCERRAMENTO_ANO_LETIVO'
  | 'REABERTURA_ANO_LETIVO'
  | 'PAGAMENTO_CONFIRMADO'
  | 'COMUNICADO_OFICIAL'
  | 'BOLETIM_ESCOLAR'
  | 'NOTA_LANCADA'
  | 'RECIBO_FOLHA_PAGAMENTO'
  | 'SOCIAL_EMAIL_LOGIN_CODE';

/**
 * Dados para template de e-mail
 */
export interface EmailData {
  [key: string]: any;
}

/**
 * Resultado do envio de e-mail
 */
export interface EmailResult {
  success: boolean;
  emailLogId?: string;
  error?: string;
}

/** Não guardar código OTP em `dados_email` / retry (segurança). */
function sanitizeEmailLogPayload(
  tipo: EmailType,
  data: EmailData,
  html: string,
): { data: EmailData; html: string } {
  if (tipo === 'SOCIAL_EMAIL_LOGIN_CODE') {
    return {
      data: { nomeUsuario: data.nomeUsuario },
      html: '[conteúdo omitido — e-mail com código de uso único]',
    };
  }
  return { data, html };
}

/**
 * Serviço centralizado de envio de e-mails
 * - Centraliza toda lógica de envio
 * - Registra logs automaticamente
 * - Respeita multi-tenant
 * - Não quebra se e-mail falhar
 */
export class EmailService {
  /**
   * Enviar e-mail via API HTTPS do Resend.
   * Todo o fluxo de emails utiliza exclusivamente o Resend.
   */
  private static async sendViaResendApi(
    from: string,
    to: string,
    subject: string,
    html: string,
    attachments?: Array<{ filename: string; content: Buffer | string }>
  ): Promise<{ messageId?: string; error?: string }> {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) return { error: 'RESEND_API_KEY não configurada' };

    const body: Record<string, unknown> = {
      from,
      to: [to],
      subject,
      html,
    };
    if (attachments?.length) {
      body.attachments = attachments.map((a) => ({
        filename: a.filename,
        content: Buffer.isBuffer(a.content) ? a.content.toString('base64') : a.content,
      }));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = (await res.json()) as { id?: string; message?: string; statusCode?: number };
      if (!res.ok) {
        const msg = data?.message || `HTTP ${res.status}`;
        return { error: msg };
      }
      return { messageId: data?.id };
    } catch (e: any) {
      clearTimeout(timeout);
      if (e?.name === 'AbortError') return { error: 'Connection timeout' };
      return { error: e?.message || 'Erro ao chamar API Resend' };
    }
  }

  /**
   * Obter dados da instituição para personalização de e-mails
   */
  private static async obterDadosInstituicao(instituicaoId?: string): Promise<{
    nome: string;
    logoUrl?: string | null;
    corPrimaria?: string | null;
    corSecundaria?: string | null;
  }> {
    if (!instituicaoId) {
      return {
        nome: 'DSICOLA',
        logoUrl: null,
        corPrimaria: '#4F46E5',
        corSecundaria: '#8B5CF6',
      };
    }

    try {
      const instituicao = await prisma.instituicao.findUnique({
        where: { id: instituicaoId },
        select: {
          nome: true,
          logoUrl: true,
          configuracao: {
            select: {
              corPrimaria: true,
              corSecundaria: true,
            },
          },
        },
      });

      if (instituicao) {
        const cores = instituicao.configuracao as { corPrimaria?: string; corSecundaria?: string } | null;
        return {
          nome: instituicao.nome,
          logoUrl: instituicao.logoUrl,
          corPrimaria: cores?.corPrimaria || '#4F46E5',
          corSecundaria: cores?.corSecundaria || '#8B5CF6',
        };
      }
    } catch (error) {
      console.error('[EmailService] Erro ao buscar dados da instituição:', error);
    }

    return {
      nome: 'DSICOLA',
      logoUrl: null,
      corPrimaria: '#4F46E5',
      corSecundaria: '#8B5CF6',
    };
  }

  /**
   * Gerar template base HTML padronizado com identidade institucional
   */
  private static gerarTemplateBase(
    titulo: string,
    conteudo: string,
    instituicao: { nome: string; logoUrl?: string | null; corPrimaria?: string | null; corSecundaria?: string | null }
  ): string {
    const corPrimaria = instituicao.corPrimaria ?? '#4F46E5';
    const corSecundaria = instituicao.corSecundaria ?? '#8B5CF6';
    const logoHtml = instituicao.logoUrl
      ? `<img src="${instituicao.logoUrl}" alt="${instituicao.nome}" style="max-height: 60px; margin-bottom: 20px;" />`
      : `<h1 style="margin: 0; font-size: 24px;">${instituicao.nome}</h1>`;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f5f5f5;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background-color: #ffffff;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .header { 
            background: linear-gradient(135deg, ${corPrimaria} 0%, ${corSecundaria} 100%); 
            color: white; 
            padding: 30px 20px; 
            text-align: center; 
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
          }
          .content { 
            padding: 30px 20px; 
            background: #ffffff;
          }
          .footer { 
            padding: 20px; 
            text-align: center; 
            color: #666; 
            font-size: 12px; 
            background-color: #f9f9f9;
            border-top: 1px solid #e5e5e5;
          }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background: ${corPrimaria}; 
            color: white; 
            text-decoration: none; 
            border-radius: 6px; 
            margin: 20px 0; 
            font-weight: 500;
          }
          .button:hover {
            background: ${corSecundaria};
          }
          .credentials { 
            background: #f9fafb; 
            padding: 15px; 
            border-left: 4px solid ${corPrimaria}; 
            margin: 20px 0; 
            border-radius: 4px; 
          }
          .warning { 
            background: #FEF3C7; 
            border-left: 4px solid #F59E0B; 
            padding: 12px; 
            margin: 15px 0; 
            border-radius: 4px; 
          }
          .info-box {
            background: #EFF6FF;
            border-left: 4px solid #3B82F6;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          @media only screen and (max-width: 600px) {
            .container {
              width: 100% !important;
            }
            .content {
              padding: 20px 15px !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            ${logoHtml}
            <h1>${titulo}</h1>
          </div>
          <div class="content">
            ${conteudo}
          </div>
          <div class="footer">
            <p><strong>${instituicao.nome}</strong></p>
            <p>Este é um e-mail automático do sistema DSICOLA. Por favor, não responda.</p>
            <p style="margin-top: 10px; color: #999; font-size: 11px;">
              © ${new Date().getFullYear()} DSICOLA - Sistema de Gestão Acadêmica
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Notificar SUPER_ADMINs sobre eventos críticos
   */
  static async notificarSuperAdmins(
    req: Request | null,
    tipo: EmailType,
    data: EmailData,
    assunto?: string
  ): Promise<void> {
    try {
      // Buscar todos os SUPER_ADMINs
      const superAdmins = await prisma.user.findMany({
        where: {
          roles: {
            some: {
              role: 'SUPER_ADMIN'
            }
          }
        },
        select: {
          id: true,
          email: true,
          nomeCompleto: true,
        },
      });

      // Enviar e-mail para cada SUPER_ADMIN
      for (const admin of superAdmins) {
        if (admin.email) {
          try {
            await this.sendEmail(
              req,
              admin.email,
              tipo,
              {
                ...data,
                nomeDestinatario: admin.nomeCompleto || 'Super Administrador',
              },
              {
                destinatarioNome: admin.nomeCompleto || undefined,
                customSubject: assunto,
                // SUPER_ADMIN não tem instituicaoId
              }
            );
          } catch (error: any) {
            console.error(`[EmailService] Erro ao notificar SUPER_ADMIN ${admin.email}:`, error.message);
          }
        }
      }
    } catch (error: any) {
      console.error('[EmailService] Erro ao buscar SUPER_ADMINs:', error.message);
      // Não falhar se não conseguir notificar
    }
  }

  /**
   * Validar se destinatário pode receber este tipo de e-mail (RBAC)
   */
  private static async validarDestinatarioRBAC(
    to: string,
    tipo: EmailType,
    instituicaoId?: string
  ): Promise<{ podeReceber: boolean; motivo?: string }> {
    try {
      // Buscar usuário pelo email (findFirst: mesmo email pode existir em várias instituições)
      const user = await prisma.user.findFirst({
        where: { email: to.toLowerCase() },
        include: {
          roles: {
            select: { role: true }
          }
        }
      });

      if (!user) {
        // Se não existe usuário, permitir (pode ser novo cadastro ou e-mail externo)
        return { podeReceber: true };
      }

      const userRoles = user.roles.map((r: { role: string }) => r.role) as string[];

      // Regras RBAC por tipo de e-mail
      // Conforme especificação: SUPER_ADMIN não recebe e-mails acadêmicos
      // ALUNO não recebe e-mails administrativos
      // ADMIN recebe apenas e-mails da sua instituição
      const regrasRBAC: Record<EmailType, { permitidos: string[]; bloqueados: string[] }> = {
        // E-mails administrativos globais - apenas SUPER_ADMIN e ADMIN
        INSTITUICAO_CRIADA: {
          permitidos: ['SUPER_ADMIN', 'ADMIN'],
          bloqueados: ['ALUNO', 'PROFESSOR', 'FUNCIONARIO', 'SECRETARIA']
        },
        CREDENCIAIS_ADMIN: {
          permitidos: ['SUPER_ADMIN', 'ADMIN'],
          bloqueados: ['ALUNO', 'PROFESSOR', 'FUNCIONARIO', 'SECRETARIA']
        },
        ASSINATURA_ATIVADA: {
          permitidos: ['SUPER_ADMIN', 'ADMIN'],
          bloqueados: ['ALUNO', 'PROFESSOR', 'FUNCIONARIO', 'SECRETARIA']
        },
        ASSINATURA_EXPIRADA: {
          permitidos: ['SUPER_ADMIN', 'ADMIN'],
          bloqueados: ['ALUNO', 'PROFESSOR', 'FUNCIONARIO', 'SECRETARIA']
        },
        ASSINATURA_EXPIRANDO: {
          permitidos: ['SUPER_ADMIN', 'ADMIN'],
          bloqueados: ['ALUNO', 'PROFESSOR', 'FUNCIONARIO', 'SECRETARIA']
        },
        ENCERRAMENTO_ANO_LETIVO: {
          permitidos: ['SUPER_ADMIN', 'ADMIN', 'SECRETARIA'],
          bloqueados: ['ALUNO']
        },
        REABERTURA_ANO_LETIVO: {
          permitidos: ['SUPER_ADMIN', 'ADMIN', 'SECRETARIA'],
          bloqueados: ['ALUNO']
        },
        PAGAMENTO_CONFIRMADO: {
          permitidos: ['SUPER_ADMIN', 'ADMIN', 'SECRETARIA', 'ALUNO'],
          bloqueados: []
        },
        // E-mails acadêmicos - ALUNO e PROFESSOR
        MATRICULA_ALUNO: {
          permitidos: ['ALUNO'],
          bloqueados: ['SUPER_ADMIN']
        },
        CANDIDATURA_APROVADA: {
          permitidos: ['ALUNO'],
          bloqueados: ['SUPER_ADMIN']
        },
        PLANO_ENSINO_ATRIBUIDO: {
          permitidos: ['PROFESSOR'],
          bloqueados: ['SUPER_ADMIN', 'ALUNO']
        },
        BOLETIM_ESCOLAR: {
          permitidos: ['ALUNO'],
          bloqueados: ['SUPER_ADMIN']
        },
        NOTA_LANCADA: {
          permitidos: ['ALUNO'],
          bloqueados: ['SUPER_ADMIN']
        },
        // E-mails gerais - todos podem receber (exceto SUPER_ADMIN para alguns)
        RECUPERACAO_SENHA: {
          permitidos: [],
          bloqueados: []
        },
        SENHA_REDEFINIDA: {
          permitidos: [],
          bloqueados: []
        },
        CRIACAO_CONTA_FUNCIONARIO: {
          permitidos: [],
          bloqueados: []
        },
        CRIACAO_CONTA_ACESSO: {
          permitidos: [],
          bloqueados: []
        },
        NOTIFICACAO_GERAL: {
          permitidos: [],
          bloqueados: []
        },
        COMUNICADO_OFICIAL: {
          permitidos: [],
          bloqueados: []
        },
        // Recibo salarial: destinatário é o funcionário (pode ter qualquer role ou só cadastro em Funcionario)
        RECIBO_FOLHA_PAGAMENTO: {
          permitidos: [],
          bloqueados: []
        },
        SOCIAL_EMAIL_LOGIN_CODE: {
          permitidos: [],
          bloqueados: []
        }
      };

      const regra = regrasRBAC[tipo];
      if (!regra) {
        return { podeReceber: true }; // Se não houver regra, permitir
      }

      // Verificar se está bloqueado
      const temRoleBloqueada = regra.bloqueados.some(role => userRoles.includes(role as any));
      if (temRoleBloqueada) {
        return {
          podeReceber: false,
          motivo: `Usuário com role bloqueada para este tipo de e-mail: ${tipo}`
        };
      }

      // Se há lista de permitidos, verificar se tem alguma role permitida
      if (regra.permitidos.length > 0) {
        const temRolePermitida = regra.permitidos.some(role => userRoles.includes(role as any));
        if (!temRolePermitida) {
          return {
            podeReceber: false,
            motivo: `Usuário não tem role permitida para este tipo de e-mail: ${tipo}`
          };
        }
      }

      return { podeReceber: true };
    } catch (error) {
      // Em caso de erro, permitir (não bloquear envio por falha de validação)
      console.error('[EmailService] Erro ao validar RBAC:', error);
      return { podeReceber: true };
    }
  }

  /**
   * Gerar template HTML básico usando identidade institucional
   */
  private static async generateTemplate(
    tipo: EmailType,
    data: EmailData,
    instituicaoId?: string
  ): Promise<string> {
    // Obter dados da instituição
    const instituicao = await this.obterDadosInstituicao(instituicaoId);
    type InstituicaoDados = Awaited<ReturnType<typeof this.obterDadosInstituicao>>;
    const templates: Record<EmailType, (data: EmailData, inst: InstituicaoDados) => string> = {
      INSTITUICAO_CRIADA: (data, instituicao) => {
        const raw = (process.env.PLATFORM_BASE_DOMAIN || 'dsicola.com').replace(/^https?:\/\//, '').split('/')[0];
        const rootDomain = raw.startsWith('app.') ? raw.slice(4) : raw;
        const isLocal = rootDomain.includes('localhost');
        const urlLogin = data.subdominio
          ? (isLocal ? `http://localhost:5173/auth` : `https://${data.subdominio}.${rootDomain}/auth`)
          : (isLocal ? 'http://localhost:5173/auth' : `https://app.${rootDomain}/auth`);
        const temCredenciais = data.emailAdmin && (data.senhaAdmin || data.senhaGerada);
        const subdominioCompleto = data.subdominio ? `${data.subdominio}.${rootDomain}` : null;
        const coords = data.coordenadasBancarias || {};
        const temCoordenadas = coords.banco || coords.iban || coords.nib || coords.titular;
        const restricao = coords.restricao || 'Só aceitamos transferência pelo ATM ou Depósito na Conta';
        const blocoCoordenadas = temCoordenadas ? `
          <div style="background: #f0fdf4; border: 1px solid #22c55e; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <h3 style="color: #15803d; margin: 0 0 12px 0; font-size: 16px;">📋 Coordenadas Bancárias para Pagamento da Licença</h3>
            <p style="color: #b91c1c; font-size: 13px; font-weight: 600; margin: 0 0 12px 0; padding: 8px 12px; background: #fef2f2; border-radius: 6px;">⚠️ ${restricao}</p>
            <p style="color: #166534; font-size: 14px; margin: 0 0 12px 0;">Para ativar a sua assinatura, efetue o pagamento através de transferência ou depósito para:</p>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              ${coords.banco ? `<tr><td style="color: #6b7280; padding: 6px 0; width: 120px;">Banco:</td><td style="font-weight: 600; color: #111827;">${coords.banco}</td></tr>` : ''}
              ${coords.iban ? `<tr><td style="color: #6b7280; padding: 6px 0;">IBAN:</td><td style="font-weight: 600; font-family: monospace; color: #111827;">${coords.iban}</td></tr>` : ''}
              ${coords.nib ? `<tr><td style="color: #6b7280; padding: 6px 0;">NIB:</td><td style="font-weight: 600; font-family: monospace; color: #111827;">${coords.nib}</td></tr>` : ''}
              ${coords.titular ? `<tr><td style="color: #6b7280; padding: 6px 0;">Titular:</td><td style="font-weight: 600; color: #111827;">${coords.titular}</td></tr>` : ''}
            </table>
            ${coords.instrucoes ? `<p style="color: #166534; font-size: 13px; margin: 12px 0 0 0; padding-top: 12px; border-top: 1px solid #86efac;">${coords.instrucoes}</p>` : ''}
            <p style="color: #166534; font-size: 13px; margin: 12px 0 0 0;">Após o pagamento, aceda a <strong>Minha Licença</strong> no painel para criar o pagamento, anexar o comprovativo e informar a referência. O administrador confirmará e a licença será ativada.</p>
          </div>
        ` : '';
        const conteudo = `
          <h2>Bem-vindo ao DSICOLA!</h2>
          <p>Prezado(a) ${data.nomeAdmin || 'Administrador'},</p>
          <p>Sua instituição <strong>${data.nomeInstituicao}</strong> foi criada com sucesso no sistema DSICOLA.</p>
          <div class="info-box">
            <p><strong>Subdomínio de acesso:</strong> ${subdominioCompleto || 'N/A'}</p>
            <p><strong>URL da sua instituição:</strong> <a href="${urlLogin}">${urlLogin}</a></p>
            <p style="margin: 5px 0; font-size: 14px;">Cada instituição possui seu próprio endereço. Guarde este link para acessar o painel da sua escola.</p>
          </div>
          ${temCredenciais ? `
          <div class="credentials">
            <p><strong>Suas credenciais de acesso:</strong></p>
            <p><strong>Email:</strong> ${data.emailAdmin}</p>
            <p><strong>Senha:</strong> ${data.senhaAdmin || data.senhaGerada || '[A senha que definiu no cadastro]'}</p>
            <div class="warning" style="margin-top: 10px;">
              <p><strong>⚠️ Importante:</strong> Por segurança, altere sua senha após o primeiro acesso (Perfil → Alterar Senha).</p>
            </div>
          </div>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${urlLogin}" style="display: inline-block; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Clique aqui para aceder à sua instituição
            </a>
          </div>
          ` : `
          <p style="color: #666; font-size: 14px;">As credenciais de acesso serão enviadas quando o administrador da instituição for criado.</p>
          `}
          ${blocoCoordenadas}
          <p><strong>Orientações para começar:</strong></p>
          <ol style="margin: 10px 0; padding-left: 20px; line-height: 1.8;">
            <li>Clique no botão acima ou acesse o link no seu navegador</li>
            <li>Faça login com o email e senha informados</li>
            <li>Configure o Ano Letivo em Configuração de Ensinos</li>
            <li>Cadastre Cursos, Turmas e Disciplinas</li>
            <li>Adicione professores e alunos</li>
          </ol>
          <p>Em caso de dúvidas, entre em contato com o suporte.</p>
          <p>Atenciosamente,<br>Equipe DSICOLA</p>
        `;
        return this.gerarTemplateBase('Bem-vindo ao DSICOLA', conteudo, instituicao);
      },
      CREDENCIAIS_ADMIN: (data, instituicao) => {
        const urlLogin = data.linkLogin || (data.subdominio ? `https://${data.subdominio}.${(process.env.PLATFORM_BASE_DOMAIN || 'dsicola.com').replace(/^https?:\/\//, '').split('/')[0]}/auth` : '#');
        const conteudo = `
          <h2>Bem-vindo ao DSICOLA!</h2>
          <p>Prezado(a) ${data.nomeAdmin || 'Administrador'},</p>
          <p>Sua conta de administrador da instituição <strong>${data.nomeInstituicao || instituicao.nome}</strong> foi criada com sucesso.</p>
          <div class="info-box">
            <p><strong>Subdomínio de acesso:</strong> ${data.subdominio ? `${data.subdominio}.${(process.env.PLATFORM_BASE_DOMAIN || 'dsicola.com').replace(/^https?:\/\//, '').split('/')[0]}` : 'N/A'}</p>
            <p><strong>URL da sua instituição:</strong> <a href="${urlLogin}">${urlLogin}</a></p>
          </div>
          <div class="credentials">
            <p><strong>Suas credenciais de acesso:</strong></p>
            <p><strong>Email:</strong> ${data.emailAdmin}</p>
            <p><strong>Senha:</strong> ${data.senhaAdmin || '[Gerada automaticamente]'}</p>
          </div>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${urlLogin}" style="display: inline-block; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Clique aqui para aceder à sua instituição
            </a>
          </div>
          <p><strong>Orientações:</strong></p>
          <ol style="margin: 10px 0; padding-left: 20px; line-height: 1.8;">
            <li>Clique no botão acima ou copie o link para o seu navegador</li>
            <li>Faça login com o email e senha informados</li>
            <li>Configure o Ano Letivo em Configuração de Ensinos</li>
            <li>Cadastre Cursos, Turmas e Disciplinas</li>
            <li>Adicione professores e alunos</li>
          </ol>
          <div class="warning">
            <p><strong>⚠️ Importante:</strong> Por segurança, altere sua senha após o primeiro acesso (Perfil → Alterar Senha).</p>
          </div>
          <p>Atenciosamente,<br>Equipe DSICOLA</p>
        `;
        return this.gerarTemplateBase('Credenciais de Acesso - ' + (data.nomeInstituicao || instituicao.nome), conteudo, instituicao);
      },
      CANDIDATURA_APROVADA: (data, instituicao) => {
        const conteudo = `
          <h2>Candidatura Aprovada</h2>
          <p>Prezado(a) ${data.nomeAluno || 'Candidato'},</p>
          <p>Informamos que sua candidatura foi <strong>aprovada com sucesso</strong>.</p>
          ${data.senhaGerada ? `
            <div class="credentials">
              <p><strong>Suas credenciais de acesso:</strong></p>
              <p><strong>Email:</strong> ${data.emailAluno}</p>
              <p><strong>Senha temporária:</strong> ${data.senhaGerada}</p>
              <p><em>Por favor, altere sua senha após o primeiro acesso.</em></p>
            </div>
          ` : ''}
          ${data.curso || data.turma ? `
            <div class="info-box">
              ${data.curso ? `<p><strong>Curso:</strong> ${data.curso}</p>` : ''}
              ${data.turma ? `<p><strong>Turma:</strong> ${data.turma}</p>` : ''}
            </div>
          ` : ''}
          <p>Bem-vindo(a) à ${instituicao.nome}!</p>
          <p>Atenciosamente,<br>Secretaria Acadêmica - ${instituicao.nome}</p>
        `;
        return this.gerarTemplateBase('Candidatura Aprovada', conteudo, instituicao);
      },
      NOTIFICACAO_GERAL: (data, instituicao) => {
        const conteudo = data.mensagem || data.conteudo || '';
        return this.gerarTemplateBase(data.titulo || 'Notificação', conteudo, instituicao);
      },
      RECUPERACAO_SENHA: (data, instituicao) => {
        const conteudo = `
          <p>Prezado(a) ${data.nomeUsuario || 'Usuário'},</p>
          <p>Recebemos uma solicitação de recuperação de senha para sua conta. Clique no botão abaixo para redefinir sua senha:</p>
          <a href="${data.resetLink}" class="button">Redefinir Senha</a>
          <p style="font-size: 14px; color: #666; margin-top: 20px;">Ou copie e cole este link no navegador:</p>
          <p style="font-size: 12px; color: #999; word-break: break-all;">${data.resetLink}</p>
          <div class="warning">
            <p><strong>⚠️ Importante:</strong> Este link expira em 1 hora. Se você não solicitou esta recuperação, ignore este e-mail.</p>
          </div>
          <p>Atenciosamente,<br>Equipe ${instituicao.nome}</p>
        `;
        return this.gerarTemplateBase('Recuperação de Senha', conteudo, instituicao);
      },
      SOCIAL_EMAIL_LOGIN_CODE: (data, instituicao) => {
        const conteudo = `
          <p>Prezado(a) ${data.nomeUsuario || 'Usuário'},</p>
          <p>Utilize o código abaixo para entrar na <strong>Social</strong> (${instituicao.nome}).</p>
          <div style="text-align:center; margin: 28px 0; font-size: 32px; letter-spacing: 10px; font-weight: 700; font-family: ui-monospace, monospace; color: #111827;">
            ${data.code}
          </div>
          <div class="warning">
            <p><strong>Validade:</strong> 15 minutos. Se não solicitou este código, ignore este e-mail.</p>
          </div>
          <p>Atenciosamente,<br>${instituicao.nome}</p>
        `;
        return this.gerarTemplateBase('Código de acesso — Social', conteudo, instituicao);
      },
      SENHA_REDEFINIDA: (data, instituicao) => {
        const conteudo = `
          <p>Prezado(a) ${data.nomeUsuario || 'Usuário'},</p>
          <p>Informamos que sua senha foi <strong>redefinida com sucesso</strong> por um administrador do sistema.</p>
          <div class="credentials">
            <p><strong>Nova senha:</strong> ${data.novaSenha || '[Senha redefinida]'}</p>
          </div>
          <div class="warning">
            <p><strong>⚠️ Importante:</strong> Por segurança, recomendamos que você altere esta senha após o primeiro acesso.</p>
          </div>
          <p>Se você não solicitou esta redefinição, entre em contato com a administração imediatamente.</p>
          <p>Atenciosamente,<br>Equipe ${instituicao.nome}</p>
        `;
        return this.gerarTemplateBase('Senha Redefinida', conteudo, instituicao);
      },
      ASSINATURA_ATIVADA: (data, instituicao) => {
        const raw = (process.env.PLATFORM_BASE_DOMAIN || 'dsicola.com').replace(/^https?:\/\//, '').split('/')[0];
        const rootDomain = raw.startsWith('app.') ? raw.slice(4) : raw;
        const isLocal = rootDomain.includes('localhost');
        const urlLogin = data.subdominio
          ? (isLocal ? `http://localhost:5173/auth` : `https://${data.subdominio}.${rootDomain}/auth`)
          : (isLocal ? 'http://localhost:5173/auth' : `https://app.${rootDomain}/auth`);
        const conteudo = `
          <p>Prezado(a) ${data.nomeDestinatario || 'Administrador'},</p>
          <p>Informamos que o pagamento foi <strong>confirmado</strong> e sua assinatura está <strong>ativa</strong>. A sua instituição já pode utilizar o DSICOLA normalmente.</p>
          <div class="info-box">
            <p><strong>Plano:</strong> ${data.planoNome || 'N/A'}</p>
            ${data.dataFim ? `<p><strong>Válido até:</strong> ${data.dataFim}</p>` : ''}
            ${data.periodo ? `<p><strong>Período pago:</strong> ${data.periodo}</p>` : ''}
          </div>
          <div class="credentials">
            <p><strong>Como acessar o sistema:</strong></p>
            <p style="margin: 8px 0;"><strong>URL:</strong> <a href="${urlLogin}">${urlLogin}</a></p>
            <p style="margin: 5px 0; font-size: 14px;">Use o email e senha do administrador da instituição para fazer login.</p>
          </div>
          <p><strong>Pronto para utilizar!</strong> Aceda ao painel e continue a gestão académica e financeira da sua instituição.</p>
          <p>Atenciosamente,<br>Equipe DSICOLA</p>
        `;
        return this.gerarTemplateBase('Assinatura Ativada - Pronto para Utilizar', conteudo, instituicao);
      },
      ASSINATURA_EXPIRADA: (data, instituicao) => {
        const conteudo = `
          <p>Prezado(a) ${data.nomeDestinatario || 'Administrador'},</p>
          <div class="warning">
            <p><strong>⚠️ Atenção:</strong> Sua assinatura expirou em ${data.dataExpiracao || 'data não informada'}.</p>
          </div>
          <p>Para continuar utilizando o sistema, é necessário renovar sua assinatura.</p>
          <p>Atenciosamente,<br>Equipe DSICOLA</p>
        `;
        return this.gerarTemplateBase('Assinatura Expirada', conteudo, instituicao);
      },
      ASSINATURA_EXPIRANDO: (data, instituicao) => {
        const conteudo = `
          <p>Prezado(a) ${data.nomeDestinatario || 'Administrador'},</p>
          <div class="warning">
            <p><strong>⚠️ Lembrete:</strong> Sua assinatura expira em ${data.dataExpiracao || 'breve'} (${data.diasRestantes ?? 5} dias).</p>
          </div>
          <p>Para evitar interrupção no acesso ao sistema, recomendamos que renove sua assinatura antes da data de vencimento.</p>
          <div class="info-box">
            <p><strong>Plano atual:</strong> ${data.planoNome || 'N/A'}</p>
            <p><strong>Data de expiração:</strong> ${data.dataExpiracao || 'N/A'}</p>
          </div>
          <p>Atenciosamente,<br>Equipe DSICOLA</p>
        `;
        return this.gerarTemplateBase('Assinatura a Expirar em Breve', conteudo, instituicao);
      },
      CRIACAO_CONTA_FUNCIONARIO: (data, instituicao) => {
        const linkLogin = data.linkLogin || `${process.env.FRONTEND_URL || 'http://localhost:8080'}/auth`;
        const conteudo = `
          <h2>Bem-vindo à ${instituicao.nome}!</h2>
          <p>Prezado(a) ${data.nomeFuncionario || data.nomeUsuario || 'Colaborador'},</p>
          <p>Sua conta de acesso ao portal institucional foi criada com sucesso.</p>
          <div class="credentials">
            <p><strong>Cargo / Função:</strong> ${data.cargo || 'Funcionário'}</p>
            <p><strong>Email de acesso:</strong> ${data.email}</p>
            <p><strong>Senha temporária:</strong> ${data.senhaTemporaria || '[Gerada automaticamente]'}</p>
          </div>
          <p>Para aceder ao sistema, utilize o link abaixo:</p>
          <a href="${linkLogin}" class="button">Aceder ao sistema</a>
          <p style="font-size: 14px; color: #666; margin-top: 10px;">
            Se o botão não funcionar, copie e cole este endereço no navegador:<br />
            <span style="font-size: 12px; color: #999; word-break: break-all;">${linkLogin}</span>
          </p>
          <div class="warning">
            <p><strong>⚠️ Importante:</strong> Por segurança, a senha acima é temporária. No primeiro acesso, o sistema irá solicitar a definição de uma nova senha pessoal.</p>
          </div>
          <div class="info-box">
            <p>Este acesso é compatível com instituições de <strong>Ensino Superior</strong> e <strong>Ensino Secundário</strong> que utilizam a plataforma DSICOLA, em ambiente totalmente multi-tenant.</p>
          </div>
          <p>Atenciosamente,<br>Recursos Humanos — ${instituicao.nome}</p>
        `;
        return this.gerarTemplateBase('Conta de Acesso do Funcionário', conteudo, instituicao);
      },
      CRIACAO_CONTA_ACESSO: (data, instituicao) => {
        const link = data.linkLogin || '#';
        const conteudo = `
          <h2>Bem-vindo à ${instituicao.nome}!</h2>
          <p>Olá ${data.nomeUsuario || 'Usuário'},</p>
          <p>A sua conta de acesso ao portal da instituição foi criada com sucesso.</p>
          <div class="credentials">
            <p><strong>Email de acesso:</strong> ${data.email}</p>
            <p><strong>Senha temporária:</strong> ${data.senhaTemporaria || '[Gerada automaticamente]'}</p>
          </div>
          <div class="warning">
            <p><strong>Importante:</strong> por segurança, altere a senha após o primeiro acesso.</p>
          </div>
          <p>Para entrar no sistema, utilize o botão abaixo (recomendado) ou copie o endereço para o seu navegador:</p>
          <p style="text-align: center; margin: 24px 0;"><a href="${link}" class="button">Entrar no portal da instituição</a></p>
          <p style="font-size: 14px; color: #666; word-break: break-all;"><strong>Endereço do portal:</strong><br><a href="${link}" style="color: #2563eb;">${link}</a></p>
          <p style="font-size: 13px; color: #888;">Em Ensino Superior ou Secundário, utilize sempre o endereço da sua escola indicado acima.</p>
          <p>Atenciosamente,<br>${instituicao.nome}</p>
        `;
        return this.gerarTemplateBase('Conta de acesso ao portal', conteudo, instituicao);
      },
      MATRICULA_ALUNO: (data, instituicao) => {
        const conteudo = `
          <p>Prezado(a) ${data.nomeAluno || 'Aluno'},</p>
          <p>Informamos que sua matrícula foi <strong>confirmada com sucesso</strong>.</p>
          <div class="info-box">
            <p><strong>Curso:</strong> ${data.curso || 'N/A'}</p>
            <p><strong>Turma:</strong> ${data.turma || 'N/A'}</p>
            <p><strong>Ano Letivo:</strong> ${data.anoLetivo || 'N/A'}</p>
            ${data.numeroMatricula ? `<p><strong>Número de Matrícula:</strong> ${data.numeroMatricula}</p>` : ''}
          </div>
          <p>Bem-vindo(a) à ${instituicao.nome}! Em breve você receberá mais informações sobre o início das aulas.</p>
          <p>Atenciosamente,<br>Secretaria Acadêmica - ${instituicao.nome}</p>
        `;
        return this.gerarTemplateBase('Matrícula Confirmada', conteudo, instituicao);
      },
      PLANO_ENSINO_ATRIBUIDO: (data, instituicao) => {
        const conteudo = `
          <p>Prezado(a) ${data.nomeProfessor || 'Professor'},</p>
          <p>Informamos que você foi atribuído a um novo plano de ensino.</p>
          <div class="info-box">
            <p><strong>Disciplina:</strong> ${data.disciplina || 'N/A'}</p>
            <p><strong>Turma:</strong> ${data.turma || 'N/A'}</p>
            <p><strong>Curso:</strong> ${data.curso || 'N/A'}</p>
            <p><strong>Ano Letivo:</strong> ${data.anoLetivo || 'N/A'}</p>
          </div>
          <p>Acesse o sistema para visualizar e editar o plano de ensino.</p>
          ${data.linkPlanoEnsino ? `<a href="${data.linkPlanoEnsino}" class="button">Acessar Plano de Ensino</a>` : ''}
          <p>Atenciosamente,<br>Coordenação Acadêmica - ${instituicao.nome}</p>
        `;
        return this.gerarTemplateBase('Plano de Ensino Atribuído', conteudo, instituicao);
      },
      ENCERRAMENTO_ANO_LETIVO: (data, instituicao) => {
        const conteudo = `
          <p>Prezado(a) ${data.nomeDestinatario || 'Administrador'},</p>
          <p>Informamos que o <strong>Ano Letivo ${data.anoLetivo}</strong> foi encerrado com sucesso.</p>
          <div class="info-box">
            <p><strong>Data de Encerramento:</strong> ${data.dataEncerramento || new Date().toLocaleDateString('pt-BR')}</p>
            ${data.estatisticas ? `
              <p><strong>Estatísticas:</strong></p>
              <ul>
                ${data.estatisticas.totalTurmas ? `<li>Turmas: ${data.estatisticas.totalTurmas}</li>` : ''}
                ${data.estatisticas.totalAlunos ? `<li>Alunos: ${data.estatisticas.totalAlunos}</li>` : ''}
                ${data.estatisticas.totalAvaliacoes ? `<li>Avaliações: ${data.estatisticas.totalAvaliacoes}</li>` : ''}
              </ul>
            ` : ''}
          </div>
          <p>Todas as operações acadêmicas relacionadas a este ano letivo foram finalizadas.</p>
          <p>Atenciosamente,<br>Coordenação Acadêmica - ${instituicao.nome}</p>
        `;
        return this.gerarTemplateBase('Ano Letivo Encerrado', conteudo, instituicao);
      },
      REABERTURA_ANO_LETIVO: (data, instituicao) => {
        const conteudo = `
          <p>Prezado(a) ${data.nomeDestinatario || 'Administrador'},</p>
          <div class="warning">
            <p><strong>⚠️ ATENÇÃO:</strong> Reabertura excepcional autorizada</p>
          </div>
          <p>O <strong>Ano Letivo ${data.anoLetivo}</strong> foi reaberto excepcionalmente para correções.</p>
          <div class="info-box">
            <p><strong>Período de Reabertura:</strong> ${data.dataInicio || 'N/A'} até ${data.dataFim || 'N/A'}</p>
            <p><strong>Escopo:</strong> ${data.escopo || 'GERAL'}</p>
            <p><strong>Motivo:</strong> ${data.motivo || 'N/A'}</p>
            <p><strong>Autorizado por:</strong> ${data.autorizador || 'N/A'}</p>
          </div>
          <p>Esta reabertura é temporária e será encerrada automaticamente na data prevista.</p>
          <p>Atenciosamente,<br>Coordenação Acadêmica - ${instituicao.nome}</p>
        `;
        return this.gerarTemplateBase('Reabertura Excepcional do Ano Letivo', conteudo, instituicao);
      },
      PAGAMENTO_CONFIRMADO: (data, instituicao) => {
        const nome = data.nomeDestinatario || data.nomeAluno || 'Aluno';
        const conteudo = `
          <p>Prezado(a) ${nome},</p>
          <p>Informamos que o seu pagamento foi <strong>confirmado com sucesso</strong>.</p>
          <div class="info-box">
            <p><strong>Valor:</strong> ${data.valor || 'N/A'}</p>
            <p><strong>Data do pagamento:</strong> ${data.dataPagamento || new Date().toLocaleDateString('pt-BR')}</p>
            <p><strong>Referência:</strong> ${data.referencia || 'N/A'}</p>
          </div>
          <p>Obrigado pela sua regularidade.</p>
          <p>Atenciosamente,<br>Secretaria Financeira — ${instituicao.nome}</p>
        `;
        return this.gerarTemplateBase('Pagamento Confirmado', conteudo, instituicao);
      },
      COMUNICADO_OFICIAL: (data, instituicao) => {
        const conteudo = `
          <p>Prezado(a) ${data.nomeDestinatario || 'Usuário'},</p>
          <div class="info-box">
            ${data.mensagem || data.conteudo || ''}
          </div>
          ${data.dataComunicado ? `<p style="color: #666; font-size: 14px;"><em>Data: ${data.dataComunicado}</em></p>` : ''}
          <p>Atenciosamente,<br>${data.remetente || 'Coordenação Acadêmica'} - ${instituicao.nome}</p>
        `;
        return this.gerarTemplateBase(data.titulo || 'Comunicado Oficial', conteudo, instituicao);
      },
      BOLETIM_ESCOLAR: (data, instituicao) => {
        const conteudo = `
          <p>Prezado(a) ${data.nomeAluno || 'Aluno'},</p>
          <p>Informamos que seu boletim escolar está disponível para consulta.</p>
          <div class="info-box">
            <p><strong>Período:</strong> ${data.periodo || 'N/A'}</p>
            <p><strong>Ano Letivo:</strong> ${data.anoLetivo || 'N/A'}</p>
          </div>
          ${data.conteudoBoletim || ''}
          <p>Acesse o portal do aluno para visualizar o boletim completo.</p>
          <p>Atenciosamente,<br>Secretaria Acadêmica - ${instituicao.nome}</p>
        `;
        return this.gerarTemplateBase('Boletim Escolar', conteudo, instituicao);
      },
      NOTA_LANCADA: (data, instituicao) => {
        const notaCor = data.nota !== undefined && data.nota >= 10 ? '#10B981' : '#EF4444';
        const conteudo = `
          <p>Prezado(a) ${data.nomeAluno || 'Aluno'},</p>
          <p>Informamos que uma nova nota foi lançada para você.</p>
          <div class="info-box">
            <p><strong>Disciplina:</strong> ${data.disciplina || 'N/A'}</p>
            <p><strong>Avaliação:</strong> ${data.tipoAvaliacao || 'N/A'}</p>
            <p><strong>Nota:</strong> <span style="font-size: 24px; font-weight: bold; color: ${notaCor};">${data.nota !== undefined ? data.nota.toFixed(1) : 'N/A'}</span></p>
            ${data.turma ? `<p><strong>Turma:</strong> ${data.turma}</p>` : ''}
          </div>
          <p>Acesse o portal do aluno para visualizar todas as suas notas.</p>
          <p>Atenciosamente,<br>Secretaria Acadêmica - ${instituicao.nome}</p>
        `;
        return this.gerarTemplateBase('Nova Nota Lançada', conteudo, instituicao);
      },
      RECIBO_FOLHA_PAGAMENTO: (data, instituicao) => {
        const nomeFuncionario = data.nomeFuncionario || 'Funcionário';
        const mesNome = data.mesNome || '';
        const ano = data.ano != null ? String(data.ano) : '';
        const periodoTexto = mesNome && ano ? `mês de <strong>${mesNome}</strong> de <strong>${ano}</strong>` : (data.mesAno || 'período em referência');
        const reciboNumero = data.reciboNumero ? ` (Nº ${data.reciboNumero})` : '';
        const endereco = data.enderecoInstituicao ? `<p style="margin-top: 16px; font-size: 12px; color: #555;">${data.enderecoInstituicao}</p>` : '';
        const nomeInst = instituicao.nome || data.nomeInstituicao || 'Instituição';
        const conteudo = `
          <p>Prezado(a) <strong>${nomeFuncionario}</strong>,</p>
          <p>Saudações e votos de um bom dia.</p>
          <p>Queiram por gentileza encontrar em anexo o recibo salarial referente ao ${periodoTexto}${reciboNumero}.</p>
          <p>Valorizamos o seu esforço e compromisso com os nossos objectivos, pois o seu desempenho é fundamental para o sucesso colectivo.</p>
          <p>Sem mais assunto, permaneço à disposição.</p>
          <p>Obrigado/Thanks,</p>
          <p><strong>Recursos Humanos</strong><br>${nomeInst}</p>
          ${endereco}
        `;
        return this.gerarTemplateBase('Recibo Salarial', conteudo, instituicao);
      },
    };

    const templateFn = templates[tipo] || templates.NOTIFICACAO_GERAL;
    return templateFn(data, instituicao);
  }

  /**
   * Obter assunto do e-mail baseado no tipo
   * Inclui nome da instituição quando disponível
   */
  private static getSubject(tipo: EmailType, data: EmailData, nomeInstituicao?: string): string {
    const nomeInst = nomeInstituicao || data.nomeInstituicao || 'DSICOLA';
    
    const subjects: Record<EmailType, (data: EmailData, nomeInst: string) => string> = {
      INSTITUICAO_CRIADA: (data, nomeInst) => `Bem-vindo ao ${nomeInst}`,
      CREDENCIAIS_ADMIN: (data, nomeInst) => `Credenciais de Acesso - ${nomeInst}`,
      CANDIDATURA_APROVADA: (data, nomeInst) => `Candidatura Aprovada - ${nomeInst}`,
      NOTIFICACAO_GERAL: (data, nomeInst) => data.titulo || data.assunto || `Notificação - ${nomeInst}`,
      RECUPERACAO_SENHA: (data, nomeInst) => `Recuperação de Senha - ${nomeInst}`,
      SOCIAL_EMAIL_LOGIN_CODE: (data, nomeInst) => `Código para entrar na Social - ${nomeInst}`,
      SENHA_REDEFINIDA: (data, nomeInst) => `Senha Redefinida - ${nomeInst}`,
      CRIACAO_CONTA_FUNCIONARIO: (data, nomeInst) => `Conta de Acesso - Funcionário - ${nomeInst}`,
      ASSINATURA_ATIVADA: (data, nomeInst) => `Assinatura Ativada - ${nomeInst}`,
      ASSINATURA_EXPIRADA: (data, nomeInst) => `Assinatura Expirada - ${nomeInst}`,
      ASSINATURA_EXPIRANDO: (data, nomeInst) => `Lembrete: Assinatura a expirar em breve - ${nomeInst}`,
      CRIACAO_CONTA_ACESSO: (data, nomeInst) => `Conta de Acesso Criada - ${nomeInst}`,
      MATRICULA_ALUNO: (data, nomeInst) => `Matrícula Confirmada - ${nomeInst}`,
      PLANO_ENSINO_ATRIBUIDO: (data, nomeInst) => `Plano de Ensino Atribuído - ${nomeInst}`,
      ENCERRAMENTO_ANO_LETIVO: (data, nomeInst) => `Ano Letivo ${data.anoLetivo || ''} Encerrado - ${nomeInst}`,
      REABERTURA_ANO_LETIVO: (data, nomeInst) => `Reabertura Excepcional - Ano Letivo ${data.anoLetivo || ''} - ${nomeInst}`,
      PAGAMENTO_CONFIRMADO: (data, nomeInst) => `Pagamento Confirmado - ${nomeInst}`,
      COMUNICADO_OFICIAL: (data, nomeInst) => data.titulo ? `Comunicado: ${data.titulo} - ${nomeInst}` : `Comunicado Oficial - ${nomeInst}`,
      BOLETIM_ESCOLAR: (data, nomeInst) => `Boletim Escolar - ${nomeInst}`,
      NOTA_LANCADA: (data, nomeInst) => `Nova Nota Lançada - ${nomeInst}`,
      RECIBO_FOLHA_PAGAMENTO: (data, nomeInst) => `RECIBO SALARIAL ${(data.mesNome || data.mesAno || '').toString().toUpperCase()} | ${nomeInst.toUpperCase()}`,
    };

    return subjects[tipo] ? subjects[tipo](data, nomeInst) : `Notificação - ${nomeInst}`;
  }

  /**
   * Registrar envio de e-mail no banco
   * Valida multi-tenant: se req está disponível, valida que instituicaoId corresponde
   */
  private static async registrarEmail(
    req: Request | null,
    params: {
      destinatarioEmail: string;
      destinatarioNome?: string;
      assunto: string;
      tipo: string;
      status: 'enviado' | 'erro';
      erro?: string;
      instituicaoId?: string;
      dadosEmail?: any;
      tentativas?: number;
      proximaTentativa?: Date | null;
    }
  ): Promise<string> {
    // Se não tiver req, tentar obter instituicaoId de outra forma
    let instituicaoId = params.instituicaoId;

    if (req && !instituicaoId) {
      try {
        instituicaoId = requireTenantScope(req);
      } catch {
        // Se não conseguir obter do req, usar null (pode ser SUPER_ADMIN)
        instituicaoId = undefined;
      }
    }

    // VALIDAÇÃO MULTI-TENANT: Se req está disponível e temos instituicaoId nas options,
    // validar que corresponde ao do contexto (exceto SUPER_ADMIN)
    if (req && req.user && params.instituicaoId) {
      const userInstituicaoId = req.user.instituicaoId;
      const isSuperAdmin = req.user.roles?.includes('SUPER_ADMIN');
      
      // SUPER_ADMIN pode enviar para qualquer instituição
      if (!isSuperAdmin && userInstituicaoId && params.instituicaoId !== userInstituicaoId) {
        // Registrar tentativa bloqueada no monitoramento de segurança
        if (req) {
          await SecurityMonitorService.logEmailBlockedAttempt(req, {
            userInstituicaoId,
            requestedInstituicaoId: params.instituicaoId,
            destinatarioEmail: params.destinatarioEmail,
            tipo: params.tipo,
          }).catch((error) => {
            // Não quebrar se o monitoramento falhar
            console.error('[EmailService] Erro ao registrar tentativa bloqueada:', error);
          });
        }
        
        // Usar instituicaoId do contexto para segurança
        instituicaoId = userInstituicaoId;
      }
    }

    const emailRegistro = await prisma.emailEnviado.create({
      data: {
        destinatarioEmail: params.destinatarioEmail,
        destinatarioNome: params.destinatarioNome || null,
        assunto: params.assunto,
        tipo: params.tipo,
        status: params.status,
        erro: params.erro || null,
        instituicaoId: instituicaoId || null,
        dadosEmail: params.dadosEmail || null,
        tentativas: params.tentativas || (params.status === 'enviado' ? 1 : 0),
        proximaTentativa: params.proximaTentativa || null,
        ultimaTentativa: params.status === 'erro' ? new Date() : null,
      },
    });

    // Auditoria (se tiver req)
    if (req) {
      try {
        await AuditService.log(req, {
          modulo: 'COMUNICACAO',
          acao: params.status === 'enviado' ? 'EMAIL_SENT' : 'EMAIL_FAILED',
          entidade: 'EmailEnviado',
          entidadeId: emailRegistro.id,
          dadosNovos: {
            destinatarioEmail: params.destinatarioEmail,
            assunto: params.assunto,
            tipo: params.tipo,
            status: params.status,
          },
          observacao: params.erro || undefined,
        });
      } catch (error) {
        // Não quebrar se auditoria falhar
        console.error('[EmailService] Erro ao registrar auditoria:', error);
      }
    }

    return emailRegistro.id;
  }

  /**
   * Enviar e-mail de forma centralizada
   * 
   * @param req - Request (opcional, para multi-tenant e auditoria)
   * @param to - Email do destinatário
   * @param tipo - Tipo de e-mail
   * @param data - Dados para o template
   * @param options - Opções adicionais (nome destinatário, instituicaoId manual)
   * @returns Resultado do envio
   */
  static async sendEmail(
    req: Request | null,
    to: string,
    tipo: EmailType,
    data: EmailData,
    options?: {
      destinatarioNome?: string;
      instituicaoId?: string;
      customSubject?: string;
      customHtml?: string;
      attachments?: Array<{ filename: string; content: Buffer }>;
    }
  ): Promise<EmailResult> {
    let instituicaoId: string | undefined = options?.instituicaoId;
    try {
      
      // VALIDAÇÃO MULTI-TENANT: Se req está disponível, validar que instituicaoId corresponde
      if (req && req.user) {
        const userInstituicaoId = req.user.instituicaoId;
        const isSuperAdmin = req.user.roles?.includes('SUPER_ADMIN');
        
        // Se não foi passado instituicaoId, usar do contexto
        if (!instituicaoId && userInstituicaoId) {
          instituicaoId = userInstituicaoId;
        }
        
        // SUPER_ADMIN pode enviar para qualquer instituição
        if (!isSuperAdmin && userInstituicaoId && instituicaoId && instituicaoId !== userInstituicaoId) {
          // Registrar tentativa bloqueada no monitoramento de segurança
          await SecurityMonitorService.logEmailBlockedAttempt(req, {
            userInstituicaoId,
            requestedInstituicaoId: instituicaoId,
            destinatarioEmail: to,
            tipo,
          }).catch((error) => {
            // Não quebrar se o monitoramento falhar
            console.error('[EmailService] Erro ao registrar tentativa bloqueada:', error);
          });

          // Usar instituicaoId do contexto para segurança
          instituicaoId = userInstituicaoId;
        }
      }

      // VALIDAÇÃO RBAC: Verificar se destinatário pode receber este tipo de e-mail
      const validacaoRBAC = await this.validarDestinatarioRBAC(to, tipo, instituicaoId);
      if (!validacaoRBAC.podeReceber) {
        console.warn(`[EmailService] ⚠️ E-mail bloqueado por RBAC: ${validacaoRBAC.motivo}`);
        // Registrar tentativa bloqueada
        try {
        // Obter nome da instituição para o assunto
        const instituicao = await this.obterDadosInstituicao(instituicaoId);
        await this.registrarEmail(req, {
          destinatarioEmail: to,
          destinatarioNome: options?.destinatarioNome,
          assunto: options?.customSubject || this.getSubject(tipo, data, instituicao.nome),
          tipo,
          status: 'erro',
          erro: `Bloqueado por RBAC: ${validacaoRBAC.motivo}`,
          instituicaoId: instituicaoId || undefined,
        });
        } catch (error) {
          console.error('[EmailService] Erro ao registrar e-mail bloqueado:', error);
        }
        
        return {
          success: false,
          error: validacaoRBAC.motivo,
        };
      }

      // Obter dados da instituição para personalização
      const instituicao = await this.obterDadosInstituicao(instituicaoId);

      // Um único domínio verificado (ex.: dsicola.com): todos os e-mails saem dele.
      // O nome da instituição aparece como "De:"; o endereço é sempre o verificado (evita verificar cada subdomínio).
      const verifiedEmail = process.env.EMAIL_FROM || process.env.SMTP_FROM || 'noreply@dsicola.com';
      const emailFrom = instituicao?.nome
        ? `${instituicao.nome} <${verifiedEmail}>`
        : verifiedEmail;

      // Gerar conteúdo (agora é assíncrono)
      const subject = options?.customSubject || this.getSubject(tipo, data, instituicao.nome);
      const html = options?.customHtml || await this.generateTemplate(tipo, data, instituicaoId);

      // Enviar via Resend (único provider)
      let emailSent = false;
      let errorMessage: string | undefined;

      try {
        const temResend = !!process.env.RESEND_API_KEY?.trim();
        if (!temResend) {
          if (process.env.NODE_ENV === 'production') {
            emailSent = false;
            errorMessage = 'Serviço de e-mail não configurado.';
          } else {
            console.log('[EmailService] 📧 E-mail simulado (RESEND_API_KEY não configurado):');
            console.log('  Para:', to);
            console.log('  Assunto:', subject);
            emailSent = true;
          }
        } else {
          const result = await this.sendViaResendApi(
            emailFrom,
            to,
            subject,
            html,
            options?.attachments
          );
          if (result.error) {
            emailSent = false;
            errorMessage = result.error;
            console.error('[EmailService] ❌ Erro ao enviar e-mail:', result.error);
          } else {
            emailSent = true;
            console.log('[EmailService] ✅ E-mail enviado via Resend:', result.messageId);
          }
        }
      } catch (sendError: any) {
        emailSent = false;
        errorMessage = sendError.message || 'Erro desconhecido ao enviar e-mail';
        console.error('[EmailService] ❌ Erro ao enviar e-mail:', errorMessage);
      }

      // Registrar no banco (sempre, mesmo se falhar)
      // Se falhar, salvar dados do e-mail para retry (sem segredos em tipos sensíveis)
      const logPayload = sanitizeEmailLogPayload(tipo, data, html);
      const dadosEmailParaRetry = emailSent
        ? null
        : {
            tipo,
            data: logPayload.data,
            subject,
            html: logPayload.html,
          };

      const emailLogId = await this.registrarEmail(req, {
        destinatarioEmail: to,
        destinatarioNome: options?.destinatarioNome,
        assunto: subject,
        tipo,
        status: emailSent ? 'enviado' : 'erro',
        erro: errorMessage,
        instituicaoId: instituicaoId || undefined,
        dadosEmail: dadosEmailParaRetry,
        tentativas: emailSent ? 1 : 0,
        proximaTentativa: emailSent ? null : new Date(Date.now() + 5 * 60 * 1000), // 5 minutos
      });

      return {
        success: emailSent,
        emailLogId,
        error: errorMessage,
      };
    } catch (error: any) {
      const errorMessage = error.message || 'Erro desconhecido no EmailService';
      console.error('[EmailService] ❌ Erro crítico:', errorMessage);

      // Tentar registrar erro no banco
      try {
        // Obter nome da instituição para o assunto
        const instituicao = await this.obterDadosInstituicao(instituicaoId);
        const subject = options?.customSubject || this.getSubject(tipo, data, instituicao.nome);
        const html = options?.customHtml || await this.generateTemplate(tipo, data, instituicaoId);
        const logPayload = sanitizeEmailLogPayload(tipo, data, html);

        const emailLogId = await this.registrarEmail(req, {
          destinatarioEmail: to,
          destinatarioNome: options?.destinatarioNome,
          assunto: subject,
          tipo,
          status: 'erro',
          erro: errorMessage,
          instituicaoId: instituicaoId || undefined,
          dadosEmail: {
            tipo,
            data: logPayload.data,
            subject,
            html: logPayload.html,
          },
          tentativas: 0,
          proximaTentativa: new Date(Date.now() + 5 * 60 * 1000), // 5 minutos
        });

        return {
          success: false,
          emailLogId,
          error: errorMessage,
        };
      } catch (dbError) {
        // Se até o registro falhar, retornar erro sem log
        return {
          success: false,
          error: errorMessage,
        };
      }
    }
  }
}

