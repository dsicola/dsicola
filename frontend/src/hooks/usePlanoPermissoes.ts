import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Estados do Plano de Ensino (EstadoRegistro)
 * Nota: BLOQUEADO não é um estado, mas sim um campo boolean separado
 * Quando um plano está bloqueado, o campo bloqueado = true
 */
export type EstadoPlano = 'RASCUNHO' | 'EM_REVISAO' | 'APROVADO' | 'ENCERRADO';

/**
 * Interface para informações de permissões do plano
 */
export interface PlanoPermissoes {
  /**
   * Se o professor pode visualizar o plano
   * REGRA: Professor vê planos em todos os estados
   */
  podeVer: boolean;
  
  /**
   * Se o professor pode realizar ações pedagógicas (lançar aulas, presenças, notas, etc.)
   * REGRA: Professor só pode agir se o plano estiver APROVADO
   */
  podeAgir: boolean;
  
  /**
   * Mensagem explicativa do motivo de bloqueio (se houver)
   */
  motivoBloqueio: string | null;
  
  /**
   * Estado atual do plano
   */
  estado: EstadoPlano | null;
  
  /**
   * Se o plano está bloqueado (campo bloqueado = true)
   */
  bloqueado: boolean;
}

/**
 * Hook para verificar permissões do professor baseado no estado do plano
 * 
 * REGRAS DE NEGÓCIO:
 * | Estado do Plano | Bloqueado? | Professor vê? | Pode agir? |
 * |-----------------|------------|---------------|------------|
 * | RASCUNHO        | -          | ✅ Sim         | ❌ Não      |
 * | EM_REVISAO      | -          | ✅ Sim         | ❌ Não      |
 * | APROVADO        | ❌ Não      | ✅ Sim         | ✅ Sim      |
 * | APROVADO        | ✅ Sim      | ✅ Sim         | ❌ Não      |
 * | ENCERRADO       | -          | ✅ Sim         | ❌ Não      |
 * 
 * Nota: BLOQUEADO é um campo boolean separado, não um estado.
 * Um plano APROVADO pode estar bloqueado (bloqueado = true), impedindo ações.
 * 
 * @param estado - Estado do plano (EstadoRegistro ou string)
 * @param bloqueado - Se o plano está bloqueado (opcional, default: false)
 * @returns Objeto com informações de permissões
 */
export function usePlanoPermissoes(
  estado: EstadoPlano | string | null | undefined,
  bloqueado: boolean = false
): PlanoPermissoes {
  const { role } = useAuth();
  const isProfessor = role === 'PROFESSOR';

  return useMemo(() => {
    // Normalizar estado para uppercase
    const estadoNormalizado = estado 
      ? (estado.toUpperCase() as EstadoPlano)
      : null;

    // REGRA: Professor sempre pode ver o plano (independente do estado)
    const podeVer = true;

    // REGRA: Professor só pode agir se:
    // 1. O plano estiver APROVADO
    // 2. O plano NÃO estiver bloqueado
    const podeAgir = isProfessor
      ? estadoNormalizado === 'APROVADO' && !bloqueado
      : true; // Outros perfis não são afetados por este hook

    // Determinar mensagem de bloqueio
    let motivoBloqueio: string | null = null;
    
    if (isProfessor && !podeAgir) {
      // Prioridade: verificar bloqueado primeiro (campo boolean)
      if (bloqueado) {
        motivoBloqueio = 'Plano de Ensino bloqueado - contacte a coordenação';
      } else if (estadoNormalizado === 'RASCUNHO') {
        motivoBloqueio = 'Plano de Ensino em RASCUNHO - aguardando aprovação';
      } else if (estadoNormalizado === 'EM_REVISAO') {
        motivoBloqueio = 'Plano de Ensino em REVISÃO - aguardando aprovação';
      } else if (estadoNormalizado === 'ENCERRADO') {
        motivoBloqueio = 'Plano de Ensino ENCERRADO - apenas visualização';
      } else if (estadoNormalizado !== 'APROVADO') {
        motivoBloqueio = `Plano de Ensino com estado "${estadoNormalizado}" - ações não permitidas`;
      }
    }

    return {
      podeVer,
      podeAgir,
      motivoBloqueio,
      estado: estadoNormalizado,
      bloqueado,
    };
  }, [estado, bloqueado, isProfessor]);
}

/**
 * Hook simplificado para verificar apenas se pode agir
 * Útil para desabilitar botões e ações na UI
 */
export function usePodeAgirNoPlano(
  estado: EstadoPlano | string | null | undefined,
  bloqueado: boolean = false
): boolean {
  const permissoes = usePlanoPermissoes(estado, bloqueado);
  return permissoes.podeAgir;
}

/**
 * EXEMPLO DE USO:
 * 
 * ```tsx
 * import { usePlanoPermissoes, usePodeAgirNoPlano } from '@/hooks/usePlanoPermissoes';
 * 
 * function ComponenteTurma({ turma }) {
 *   const { podeAgir, motivoBloqueio, podeVer } = usePlanoPermissoes(
 *     turma.planoEstado,
 *     turma.planoBloqueado
 *   );
 * 
 *   // Ou usar o hook simplificado
 *   const podeAgirSimplificado = usePodeAgirNoPlano(
 *     turma.planoEstado,
 *     turma.planoBloqueado
 *   );
 * 
 *   return (
 *     <div>
 *       {podeVer && (
 *         <div>
 *           <h3>{turma.disciplinaNome}</h3>
 *           {!podeAgir && motivoBloqueio && (
 *             <Alert variant="warning">{motivoBloqueio}</Alert>
 *           )}
 *           <Button 
 *             disabled={!podeAgir}
 *             onClick={handleLancarAula}
 *           >
 *             Lançar Aula
 *           </Button>
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */

