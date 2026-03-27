import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { conclusaoCursoApi, type VerificacaoCertificadoConclusaoResponse } from '@/services/api';
import { ShieldCheck, ShieldX, Loader2, FileCheck2 } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

/**
 * Página pública: confirma se o código impresso no certificado de conclusão (Ensino Secundário)
 * corresponde a um registo válido no DSICOLA.
 */
const VerificarCertificadoConclusao: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<VerificacaoCertificadoConclusaoResponse | null>(null);

  useEffect(() => {
    const c = (searchParams.get('codigo') || '').trim().toUpperCase();
    if (!c) return;
    setCodigo(c);
    setLoading(true);
    setResultado(null);
    conclusaoCursoApi
      .verificarCertificadoPublico(c)
      .then(setResultado)
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
      setResultado({ valido: false, mensagem: 'Introduza o código impresso no certificado.' });
      return;
    }
    setLoading(true);
    setResultado(null);
    try {
      const data = await conclusaoCursoApi.verificarCertificadoPublico(c);
      setResultado(data);
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
            <FileCheck2 className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl font-semibold tracking-tight">
            Verificação de certificado de conclusão
          </CardTitle>
          <CardDescription className="text-sm">
            Confirme a autenticidade do documento emitido pela instituição através do código alfanumérico
            constante no certificado (Ensino Secundário).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="codigo-verif">Código de verificação</Label>
              <Input
                id="codigo-verif"
                name="codigo"
                placeholder="Ex.: A1B2C3D4"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                className="font-mono text-center tracking-widest uppercase"
                autoComplete="off"
                spellCheck={false}
                maxLength={32}
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
            <Alert
              variant={resultado.valido ? 'default' : 'destructive'}
              className={resultado.valido ? 'border-green-200 bg-green-50/80 dark:bg-green-950/20' : ''}
            >
              {resultado.valido ? (
                <ShieldCheck className="h-4 w-4 text-green-600" />
              ) : (
                <ShieldX className="h-4 w-4" />
              )}
              <AlertDescription className="text-sm space-y-2">
                {resultado.valido ? (
                  <>
                    <p className="font-medium text-green-800 dark:text-green-200">
                      Registo encontrado — certificado autêntico no sistema
                    </p>
                    <ul className="list-none space-y-1 text-muted-foreground">
                      {resultado.instituicao && (
                        <li>
                          <span className="font-medium text-foreground">Instituição: </span>
                          {resultado.instituicao}
                        </li>
                      )}
                      <li>
                        <span className="font-medium text-foreground">Titular (parcial): </span>
                        {resultado.nomeParcial}
                      </li>
                      <li>
                        <span className="font-medium text-foreground">N.º do certificado: </span>
                        {resultado.numeroCertificado}
                      </li>
                      {dataFmt && (
                        <li>
                          <span className="font-medium text-foreground">Data de emissão: </span>
                          {dataFmt}
                        </li>
                      )}
                    </ul>
                    <p className="text-xs pt-2 border-t border-green-200/80 dark:border-green-900">
                      Os dados acima permitem confirmar que o documento corresponde ao registo oficial. A
                      identificação completa do titular permanece protegida.
                    </p>
                  </>
                ) : (
                  <p>{resultado.mensagem}</p>
                )}
              </AlertDescription>
            </Alert>
          )}

          <p className="text-xs text-center text-muted-foreground leading-relaxed">
            Apenas certificados de conclusão do ensino secundário emitidos neste sistema (aba Conclusão de curso,
            com número de registo). Certificados de ensino superior e declarações de «Documentos oficiais» não
            utilizam esta página.
          </p>
          <p className="text-xs text-center">
            <a href="/" className="text-primary underline-offset-4 hover:underline">
              Voltar ao início
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default VerificarCertificadoConclusao;
