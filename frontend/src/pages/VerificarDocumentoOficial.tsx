import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { documentosOficialApi } from '@/services/api';
import { VerificacaoPublicaFooterLinks } from '@/components/common/VerificacaoPublicaFooterLinks';
import { ShieldCheck, ShieldX, Loader2, QrCode } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

/** Resposta GET /documentos/verificar */
export type VerificacaoDocumentoOficialResponse = {
  valido: boolean;
  mensagem?: string;
  instituicao?: string;
  nomeParcial?: string;
  dataEmissao?: string;
  tipoDocumento?: string;
};

function labelTipoDoc(tipo: string | undefined): string {
  if (!tipo) return 'Documento oficial';
  const map: Record<string, string> = {
    DECLARACAO_MATRICULA: 'Declaração de matrícula',
    DECLARACAO_FREQUENCIA: 'Declaração de frequência',
    HISTORICO: 'Histórico escolar',
    CERTIFICADO: 'Certificado (modelo institucional)',
  };
  return map[tipo] || tipo.replace(/_/g, ' ').toLowerCase();
}

/**
 * Página pública alinhada ao QR dos PDFs (declarações, certificados por modelo, etc.):
 * mesma origem que GET /documentos/verificar no backend.
 */
const VerificarDocumentoOficial: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<VerificacaoDocumentoOficialResponse | null>(null);

  useEffect(() => {
    const c = (searchParams.get('codigo') || '').trim().toUpperCase();
    if (!c) return;
    setCodigo(c);
    setLoading(true);
    setResultado(null);
    documentosOficialApi
      .verificar(c)
      .then((data: VerificacaoDocumentoOficialResponse) => setResultado(data))
      .catch(() =>
        setResultado({
          valido: false,
          mensagem: 'Não foi possível contactar o serviço de verificação. Tente mais tarde.',
        })
      )
      .finally(() => setLoading(false));
  }, [searchParams]);

  const consultar = async (raw: string) => {
    const c = raw.trim().toUpperCase();
    if (!c) {
      setResultado({ valido: false, mensagem: 'Introduza o código impresso no documento ou lido no QR Code.' });
      return;
    }
    setLoading(true);
    setResultado(null);
    try {
      const data = await documentosOficialApi.verificar(c);
      setResultado(data as VerificacaoDocumentoOficialResponse);
    } catch {
      setResultado({
        valido: false,
        mensagem: 'Não foi possível contactar o serviço de verificação. Tente mais tarde.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void consultar(codigo);
  };

  const dataFmt =
    resultado?.valido && resultado.dataEmissao
      ? format(new Date(resultado.dataEmissao), "d 'de' MMMM yyyy", { locale: pt })
      : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/40 to-background flex items-center justify-center p-4 md:p-8">
      <Card className="w-full max-w-lg border shadow-md">
        <CardHeader className="space-y-1 text-center pb-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-1">
            <QrCode className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl font-semibold tracking-tight">Verificação de documento oficial</CardTitle>
          <CardDescription className="text-sm">
            Confirme a autenticidade de declarações, históricos ou certificados emitidos pelo sistema com código ou QR
            Code (documentos registados em «Emitir documento oficial»).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="codigo-doc-verif">Código de verificação</Label>
              <Input
                id="codigo-doc-verif"
                name="codigo"
                placeholder="Código no documento"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                className="font-mono text-center tracking-widest uppercase"
                autoComplete="off"
                spellCheck={false}
                maxLength={64}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  A verificar…
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Verificar
                </>
              )}
            </Button>
          </form>

          {resultado && (
            <Alert variant={resultado.valido ? 'default' : 'destructive'}>
              {resultado.valido ? (
                <ShieldCheck className="h-4 w-4" />
              ) : (
                <ShieldX className="h-4 w-4" />
              )}
              <AlertDescription className="space-y-2">
                {resultado.valido ? (
                  <>
                    <p className="font-medium text-foreground">Documento válido e ativo nos registos da instituição.</p>
                    {resultado.instituicao && (
                      <p className="text-sm">
                        <span className="text-muted-foreground">Instituição: </span>
                        {resultado.instituicao}
                      </p>
                    )}
                    <p className="text-sm">
                      <span className="text-muted-foreground">Tipo: </span>
                      {labelTipoDoc(resultado.tipoDocumento)}
                    </p>
                    {resultado.nomeParcial && (
                      <p className="text-sm">
                        <span className="text-muted-foreground">Titular (parcial): </span>
                        {resultado.nomeParcial}
                      </p>
                    )}
                    {dataFmt && (
                      <p className="text-sm">
                        <span className="text-muted-foreground">Data de emissão: </span>
                        {dataFmt}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground pt-1">
                      O nome completo não é exibido por motivos de privacidade. Em caso de dúvida, contacte a instituição
                      emissora.
                    </p>
                  </>
                ) : (
                  <p>{resultado.mensagem || 'Documento inválido, anulado ou código incorrecto.'}</p>
                )}
              </AlertDescription>
            </Alert>
          )}

          <p className="text-xs text-center text-muted-foreground leading-relaxed">
            Use esta página para códigos de documentos emitidos em «Emitir documento oficial» (declarações, histórico,
            certificado por modelo). Mini pautas em PDF e certificados de conclusão do secundário registados em «Conclusão
            de curso» têm verificação separada — veja os atalhos abaixo.
          </p>
          <VerificacaoPublicaFooterLinks current="documento" />
        </CardContent>
      </Card>
    </div>
  );
};

export default VerificarDocumentoOficial;
