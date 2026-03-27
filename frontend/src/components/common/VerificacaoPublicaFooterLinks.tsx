import { Link } from 'react-router-dom';
import { PATH_VERIFICAR_CERTIFICADO_CONCLUSAO, PATH_VERIFICAR_PAUTA } from '@/components/common/AutenticidadeVerificacaoCallout';

export type VerificacaoPublicaPagina = 'documento' | 'certificado' | 'pauta';

/**
 * Rodapé partilhado das páginas públicas de verificação (mesmo domínio da instituição).
 */
export function VerificacaoPublicaFooterLinks({ current }: { current: VerificacaoPublicaPagina }) {
  const sep = <span className="mx-1.5">·</span>;
  const linkClass = 'text-primary underline-offset-4 hover:underline';

  return (
    <>
      <p className="text-xs text-center text-muted-foreground">
        <span className="font-medium text-foreground">Tipos de verificação: </span>
        {current === 'documento' ? (
          <span className="text-foreground">Documento oficial</span>
        ) : (
          <Link to="/verificar-documento" className={linkClass}>
            Documento oficial
          </Link>
        )}
        {sep}
        {current === 'pauta' ? (
          <span className="text-foreground">Mini pauta</span>
        ) : (
          <Link to={PATH_VERIFICAR_PAUTA} className={linkClass}>
            Mini pauta
          </Link>
        )}
        {sep}
        {current === 'certificado' ? (
          <span className="text-foreground">Certificado de conclusão</span>
        ) : (
          <Link to={PATH_VERIFICAR_CERTIFICADO_CONCLUSAO} className={linkClass}>
            Certificado de conclusão
          </Link>
        )}
      </p>
      <p className="text-xs text-center">
        <Link to="/" className={linkClass}>
          Voltar ao início
        </Link>
      </p>
    </>
  );
}
