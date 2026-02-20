import { useQuery } from "@tanstack/react-query";
import { logsAuditoriaApi } from "@/services/api";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { User, Calendar, Activity, Shield, FileText, AlertCircle, CheckCircle, XCircle, ArrowRight } from "lucide-react";
import { Loader2 } from "lucide-react";

interface DetalhesAuditoriaDialogProps {
  logId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DetalhesAuditoria {
  id: string;
  acao: string;
  entidade?: string | null;
  entidadeId?: string | null;
  modulo?: string | null;
  dominio?: 'ACADEMICO' | 'FINANCEIRO' | 'ADMINISTRATIVO' | 'SEGURANCA' | null;
  userNome?: string | null;
  userEmail?: string | null;
  userId?: string | null;
  perfilUsuario?: string | null;
  rota?: string | null;
  ipOrigem?: string | null;
  userAgent?: string | null;
  observacao?: string | null;
  createdAt: string;
  dadosAnteriores?: any;
  dadosNovos?: any;
  camposAlterados?: string[];
  comparacao?: {
    temAntes: boolean;
    temDepois: boolean;
    podeComparar: boolean;
    totalCamposAlterados?: number;
  };
  instituicao?: { id: string; nome: string } | null;
}

const acoesLabels: { [key: string]: string } = {
  CREATE: "Criar",
  UPDATE: "Atualizar",
  DELETE: "Excluir",
  SUBMIT: "Submeter",
  APPROVE: "Aprovar",
  REJECT: "Rejeitar",
  CLOSE: "Encerrar",
  REOPEN: "Reabrir",
  BLOCK: "Bloquear",
  ESTORNAR: "Estornar",
  LOGIN_SUCCESS: "Login bem-sucedido",
  LOGIN_FAILED: "Tentativa de login falhou",
  LOGIN_BLOCKED: "Conta bloqueada",
  LOGIN_UNLOCKED: "Conta desbloqueada",
  SECURITY_ALERT: "Alerta de segurança",
};

const dominioLabels: { [key: string]: string } = {
  ACADEMICO: "Acadêmico",
  FINANCEIRO: "Financeiro",
  ADMINISTRATIVO: "Administrativo",
  SEGURANCA: "Segurança",
};

const dominioColors: { [key: string]: string } = {
  ACADEMICO: "bg-blue-100 text-blue-800 border-blue-300",
  FINANCEIRO: "bg-green-100 text-green-800 border-green-300",
  ADMINISTRATIVO: "bg-purple-100 text-purple-800 border-purple-300",
  SEGURANCA: "bg-red-100 text-red-800 border-red-300",
};

const acaoColors: { [key: string]: string } = {
  CREATE: "bg-green-100 text-green-800 border-green-300",
  UPDATE: "bg-blue-100 text-blue-800 border-blue-300",
  DELETE: "bg-red-100 text-red-800 border-red-300",
  SUBMIT: "bg-yellow-100 text-yellow-800 border-yellow-300",
  APPROVE: "bg-green-100 text-green-800 border-green-300",
  REJECT: "bg-red-100 text-red-800 border-red-300",
  CLOSE: "bg-gray-100 text-gray-800 border-gray-300",
  REOPEN: "bg-blue-100 text-blue-800 border-blue-300",
  BLOCK: "bg-red-100 text-red-800 border-red-300",
  ESTORNAR: "bg-orange-100 text-orange-800 border-orange-300",
  LOGIN_SUCCESS: "bg-green-100 text-green-800 border-green-300",
  LOGIN_FAILED: "bg-red-100 text-red-800 border-red-300",
  LOGIN_BLOCKED: "bg-red-100 text-red-800 border-red-300",
  LOGIN_UNLOCKED: "bg-blue-100 text-blue-800 border-blue-300",
  SECURITY_ALERT: "bg-amber-100 text-amber-800 border-amber-300",
};

/**
 * Renderizar valor formatado para exibição
 * Mascarar campos sensíveis automaticamente
 */
function renderValue(value: any, campo: string = ''): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return `[${value.length} item(s)]`;
    }
    // Se já está mascarado pelo backend, manter
    if (value === '***MASCARADO***') return '***MASCARADO***';
    return JSON.stringify(value, null, 2);
  }
  if (typeof value === 'string') {
    // Verificar se já está mascarado
    if (value === '***MASCARADO***') return '***MASCARADO***';
    // Mascarar campos sensíveis no frontend também (segurança adicional)
    const campoLower = campo.toLowerCase();
    const camposSensiveis = ['senha', 'password', 'token', 'biometria', 'cpf'];
    if (camposSensiveis.some(c => campoLower.includes(c))) {
      return '***MASCARADO***';
    }
    if (value.length > 100) {
      return value.substring(0, 100) + '...';
    }
  }
  return String(value);
}

/**
 * Renderizar campo com destaque se foi alterado
 */
function renderField(
  campo: string,
  valorAntes: any,
  valorDepois: any,
  foiAlterado: boolean,
  lado: 'antes' | 'depois'
) {
  const valor = lado === 'antes' ? valorAntes : valorDepois;
  const bgColor = foiAlterado 
    ? (lado === 'antes' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200')
    : 'bg-transparent';
  
  return (
    <div key={campo} className={`p-2 rounded border ${bgColor}`}>
      <div className="text-xs font-semibold text-muted-foreground mb-1">{campo}</div>
      <div className="text-sm font-mono break-words">
        {renderValue(valor, campo)}
      </div>
    </div>
  );
}

export function DetalhesAuditoriaDialog({ logId, open, onOpenChange }: DetalhesAuditoriaDialogProps) {
  const { data: detalhes, isLoading, error } = useQuery({
    queryKey: ['auditoria-detalhes', logId],
    queryFn: async () => {
      if (!logId) return null;
      return await logsAuditoriaApi.getDetalhes(logId);
    },
    enabled: !!logId && open,
  });

  if (!open || !logId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Detalhes da Auditoria
          </DialogTitle>
          <DialogDescription>
            Informações completas da ação registrada (IMUTÁVEL - Histórico juridicamente válido)
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Carregando detalhes...</span>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="h-5 w-5" />
              <span className="font-semibold">Erro ao carregar detalhes</span>
            </div>
            <p className="text-sm text-red-600 mt-2">
              Não foi possível carregar os detalhes da auditoria. Verifique suas permissões.
            </p>
          </div>
        ) : detalhes ? (
          <div className="space-y-6">
            {/* Contexto da Auditoria */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contexto</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Usuário</div>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{detalhes.userNome || 'Sistema'}</div>
                        {detalhes.userEmail && (
                          <div className="text-xs text-muted-foreground">{detalhes.userEmail}</div>
                        )}
                        {detalhes.perfilUsuario && (
                          <Badge variant="outline" className="mt-1 text-xs">
                            {detalhes.perfilUsuario}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Ação</div>
                    <Badge className={acaoColors[detalhes.acao] || 'bg-gray-100 text-gray-800'}>
                      {acoesLabels[detalhes.acao] || detalhes.acao}
                    </Badge>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Entidade</div>
                    <div className="font-medium">{detalhes.entidade || '-'}</div>
                    {detalhes.entidadeId && (
                      <div className="text-xs font-mono text-muted-foreground mt-1">
                        {detalhes.entidadeId.substring(0, 8)}...
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Data/Hora</div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div className="font-medium">
                        {format(new Date(detalhes.createdAt), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                      </div>
                    </div>
                  </div>

                  {detalhes.dominio && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Domínio</div>
                      <Badge className={dominioColors[detalhes.dominio] || 'bg-gray-100 text-gray-800'}>
                        {dominioLabels[detalhes.dominio] || detalhes.dominio}
                      </Badge>
                    </div>
                  )}

                  {detalhes.modulo && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Módulo</div>
                      <div className="font-medium text-sm">{detalhes.modulo}</div>
                    </div>
                  )}

                  {detalhes.observacao && (
                    <div className="col-span-2 md:col-span-4">
                      <div className="text-xs text-muted-foreground mb-1">Observação/Justificativa</div>
                      <div className="p-2 bg-muted rounded-md text-sm">{detalhes.observacao}</div>
                    </div>
                  )}

                  {/* Informações técnicas da operação */}
                  {(detalhes.ipOrigem || detalhes.rota || detalhes.userAgent) && (
                    <>
                      {detalhes.ipOrigem && (
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">IP de origem</div>
                          <div className="font-mono text-sm">{detalhes.ipOrigem}</div>
                        </div>
                      )}
                      {detalhes.rota && (
                        <div className="col-span-2">
                          <div className="text-xs text-muted-foreground mb-1">Rota da API</div>
                          <div className="font-mono text-sm break-all">{detalhes.rota}</div>
                        </div>
                      )}
                      {detalhes.userAgent && (
                        <div className="col-span-2 md:col-span-4">
                          <div className="text-xs text-muted-foreground mb-1">Navegador/Dispositivo (User-Agent)</div>
                          <div className="font-mono text-xs break-all bg-muted/50 rounded p-2">{detalhes.userAgent}</div>
                        </div>
                      )}
                    </>
                  )}

                  {detalhes.instituicao && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Instituição</div>
                      <div className="font-medium text-sm">{detalhes.instituicao.nome}</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Visualização Antes/Depois */}
            {detalhes.comparacao?.podeComparar ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Comparação: Antes / Depois
                    {detalhes.comparacao.totalCamposAlterados !== undefined && (
                      <Badge variant="outline" className="ml-2">
                        {detalhes.comparacao.totalCamposAlterados} campo(s) alterado(s)
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Coluna ANTES */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <h3 className="font-semibold text-red-700">ANTES</h3>
                      </div>
                      <ScrollArea className="h-[400px] border rounded-md p-4">
                        <div className="space-y-2">
                          {detalhes.camposAlterados && detalhes.camposAlterados.length > 0 ? (
                            // Mostrar apenas campos alterados + campos relevantes (excluir campos técnicos)
                            Object.keys(detalhes.dadosAnteriores || {})
                              .filter(campo => {
                                // Incluir se foi alterado ou se é campo relevante para auditoria
                                const foiAlterado = detalhes.camposAlterados?.includes(campo) || false;
                                const isRelevante = ['id', 'status', 'estado', 'bloqueado'].includes(campo);
                                // Excluir campos técnicos que não mudam
                                const isTecnico = ['createdAt', 'created_at', 'updatedAt', 'updated_at'].includes(campo);
                                return (foiAlterado || isRelevante) && !isTecnico;
                              })
                              .map(campo => 
                                renderField(
                                  campo,
                                  detalhes.dadosAnteriores?.[campo],
                                  detalhes.dadosNovos?.[campo],
                                  detalhes.camposAlterados?.includes(campo) || false,
                                  'antes'
                                )
                              )
                          ) : (
                            // Mostrar todos os campos relevantes se não houver lista de alterados
                            Object.entries(detalhes.dadosAnteriores || {})
                              .filter(([campo]) => !['createdAt', 'created_at', 'updatedAt', 'updated_at'].includes(campo))
                              .map(([campo, valor]) =>
                                renderField(campo, valor, null, false, 'antes')
                              )
                          )}
                        </div>
                      </ScrollArea>
                    </div>

                    {/* Coluna DEPOIS */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <h3 className="font-semibold text-green-700">DEPOIS</h3>
                      </div>
                      <ScrollArea className="h-[400px] border rounded-md p-4">
                        <div className="space-y-2">
                          {detalhes.camposAlterados && detalhes.camposAlterados.length > 0 ? (
                            // Mostrar apenas campos alterados + campos relevantes (excluir campos técnicos)
                            Object.keys(detalhes.dadosNovos || {})
                              .filter(campo => {
                                // Incluir se foi alterado ou se é campo relevante para auditoria
                                const foiAlterado = detalhes.camposAlterados?.includes(campo) || false;
                                const isRelevante = ['id', 'status', 'estado', 'bloqueado'].includes(campo);
                                // Excluir campos técnicos que não mudam
                                const isTecnico = ['createdAt', 'created_at', 'updatedAt', 'updated_at'].includes(campo);
                                return (foiAlterado || isRelevante) && !isTecnico;
                              })
                              .map(campo => 
                                renderField(
                                  campo,
                                  detalhes.dadosAnteriores?.[campo],
                                  detalhes.dadosNovos?.[campo],
                                  detalhes.camposAlterados?.includes(campo) || false,
                                  'depois'
                                )
                              )
                          ) : (
                            // Mostrar todos os campos relevantes se não houver lista de alterados
                            Object.entries(detalhes.dadosNovos || {})
                              .filter(([campo]) => !['createdAt', 'created_at', 'updatedAt', 'updated_at'].includes(campo))
                              .map(([campo, valor]) =>
                                renderField(campo, null, valor, false, 'depois')
                              )
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : detalhes.dadosNovos ? (
              // Apenas dados novos (CREATE)
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Dados Criados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px] border rounded-md p-4">
                    <div className="space-y-2">
                      {Object.entries(detalhes.dadosNovos || {}).map(([campo, valor]) =>
                        renderField(campo, null, valor, false, 'depois')
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            ) : detalhes.dadosAnteriores ? (
              // Apenas dados anteriores (DELETE)
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Dados Removidos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px] border rounded-md p-4">
                    <div className="space-y-2">
                      {Object.entries(detalhes.dadosAnteriores || {}).map(([campo, valor]) =>
                        renderField(campo, valor, null, false, 'antes')
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nenhum dado adicional registrado para esta ação
                </CardContent>
              </Card>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

