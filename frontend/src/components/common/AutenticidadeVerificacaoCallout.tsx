import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Info } from 'lucide-react';

export const PATH_VERIFICAR_CERTIFICADO_CONCLUSAO = '/verificar-certificado-conclusao';
/** Mini pauta (PDF provisório ou definitivo) — GET /pautas/verificar-publico */
export const PATH_VERIFICAR_PAUTA = '/verificar-pauta';

type Variant = 'conclusao' | 'emitir-documento' | 'ajuda-compacto' | 'pauta-mini';

/**
 * Texto único sobre verificação: certificado de registo (secundário, aba Conclusão),
 * superior (colação), documentos oficiais (página /verificar-documento, API /documentos/verificar).
 */
export function AutenticidadeVerificacaoCallout({ variant }: { variant: Variant }) {
  if (variant === 'emitir-documento') {
    return (
      <Alert className="border-muted-foreground/20">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <span className="font-medium">Verificação pública: </span>
          cada PDF emitido <strong>nesta área</strong> (declarações, histórico, certificado por modelo) inclui um{' '}
          <strong>código</strong> mostrado no documento e na notificação após emitir. Quem confirma a autenticidade
          usa a página pública{' '}
          <code className="text-xs rounded bg-muted px-1">/verificar-documento?codigo=…</code>
          {' '}(equivalente a <code className="text-xs rounded bg-muted px-1">GET …/documentos/verificar</code> na API). Isto é independente do{' '}
          <strong>certificado de conclusão do secundário</strong> registado na aba «Conclusão de Curso» do estudante:
          esse gera outro PDF com código e a página{' '}
          <code className="text-xs rounded bg-muted px-1">{PATH_VERIFICAR_CERTIFICADO_CONCLUSAO}</code>
          . As <strong>mini pautas</strong> (PDF do plano de ensino) usam{' '}
          <code className="text-xs rounded bg-muted px-1">{PATH_VERIFICAR_PAUTA}?codigo=…</code>.
        </AlertDescription>
      </Alert>
    );
  }

  if (variant === 'ajuda-compacto') {
    return (
      <p className="text-sm text-muted-foreground leading-relaxed">
        <span className="font-medium text-foreground">Autenticidade: </span>
        documentos gerados em <strong>Emitir documento oficial</strong> (perfil do estudante) levam código consultável
        em <code className="text-xs bg-muted px-1 rounded">/verificar-documento</code>. O certificado de conclusão do
        secundário com registo no livro (aba <strong>Conclusão de Curso</strong>) usa{' '}
        <code className="text-xs bg-muted px-1 rounded">{PATH_VERIFICAR_CERTIFICADO_CONCLUSAO}</code>. As mini pautas
        impressas (provisória ou definitiva) registam outro código em{' '}
        <code className="text-xs bg-muted px-1 rounded">{PATH_VERIFICAR_PAUTA}</code>. O superior (colação) valida-se
        junto da instituição.
      </p>
    );
  }

  if (variant === 'pauta-mini') {
    return (
      <Alert className="border-muted-foreground/20">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <span className="font-medium">Verificação pública da mini pauta: </span>
          cada PDF gerado aqui inclui um <strong>código único</strong> e, quando o domínio da instituição está
          configurado no servidor, um <strong>link</strong> para confirmar a emissão em{' '}
          <code className="text-xs rounded bg-muted px-1">{PATH_VERIFICAR_PAUTA}?codigo=…</code>. A consulta pública
          não mostra nomes nem notas dos estudantes — apenas metadados do registo (instituição, turma, disciplina,
          tipo de pauta).
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="mt-4">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="text-sm">
        <span className="font-medium">Autenticidade: </span>
        o certificado de conclusão do <strong>secundário</strong> (vinculado a uma classe) inclui{' '}
        <strong>código de verificação</strong> no PDF e a página pública{' '}
        <code className="text-xs rounded bg-muted px-1">{PATH_VERIFICAR_CERTIFICADO_CONCLUSAO}</code>. O PDF do{' '}
        <strong>superior</strong> (após colação) segue o modelo académico próprio; a validação mantém-se junto da
        instituição e do registo da colação. Declarações e outros documentos em «Documentos oficiais» (aba Emitir
        documento no estudante) usam{' '}
        <code className="text-xs rounded bg-muted px-1">/verificar-documento?codigo=…</code>.
      </AlertDescription>
    </Alert>
  );
}

/** Texto da FAQ (fonte única com o callout). */
export function getFaqRespostaCertificadosDeclaracoes(): string {
  return [
    'Há dois fluxos principais. (1) Documentos oficiais por modelo — no perfil do estudante, separador «Emitir documento oficial»:',
    'escolha o tipo (declaração, histórico, certificado por modelo), emita o PDF; o sistema guarda o documento e o código de verificação.',
    'Quem valida o papel usa a página pública …/verificar-documento?codigo=… (ou a API …/documentos/verificar) no mesmo domínio da instalação.',
    '(2) Certificado de conclusão do ensino secundário com número de registo (livro/folha) — menu Estudantes → área Conclusão de Curso / Certificação:',
    'após concluir e registar o certificado, o PDF inclui outro código e a página /verificar-certificado-conclusao.',
    '(3) Mini pauta (provisória ou definitiva) — em Notas e pautas / relatório de pauta do plano de ensino, ao imprimir PDF:',
    'o sistema regista a emissão e mostra código (e link, se configurado) para …/verificar-pauta?codigo=… (API …/pautas/verificar-publico).',
    'Ensino superior: certificado/diploma após colação de grau segue o fluxo da colação; não usa a página de código do secundário.',
    'Modelos e importação continuam em Documentos académicos (Certificados) quando a instituição os utiliza.',
  ].join(' ');
}

export function getFaqRespostaComoVerificarCodigo(): string {
  return [
    'No PDF emitido procure o código de verificação (ou o texto com o link).',
    'Se o documento foi emitido pela aba «Emitir documento oficial» do estudante: a verificação pública é …/verificar-documento?codigo=CODIGO.',
    'Se for o certificado de conclusão do secundário gerado após registo em «Conclusão de Curso»: use …/verificar-certificado-conclusao?codigo=CODIGO no front-end da instituição.',
    'Se for uma mini pauta impressa a partir do plano de ensino (PDF provisório ou definitivo): use …/verificar-pauta?codigo=CODIGO — a API pública é …/pautas/verificar-publico.',
    'A resposta indica se o registo existe e está ativo; o nome completo não é exposto por privacidade (na verificação de pauta também não aparecem notas na página pública).',
  ].join(' ');
}
