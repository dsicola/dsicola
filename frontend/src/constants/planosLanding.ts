/** Estrutura de um plano exibido na landing de vendas */
export interface PlanoLanding {
  id: string;
  nome: string;
  tagline: string;
  precoMensal: number;
  precoAnual: number;
  limites: string[];
  multiCampus: boolean;
  cta: string;
  microtexto: string;
  popular: boolean;
}

/** Planos padrão exibidos na landing - podem ser sobrescritos por config */
export const PLANOS_ESTRATEGICOS_DEFAULT: PlanoLanding[] = [
  {
    id: 'start',
    nome: 'DSICOLA START',
    tagline: 'Automatize toda a gestão académica',
    precoMensal: 350000,
    precoAnual: 3360000,
    limites: [
      'Até 500 alunos',
      '5 utilizadores administrativos',
      'Módulo Académico completo',
      'Módulo Financeiro',
      'Emissão de documentos',
    ],
    multiCampus: false,
    cta: 'Começar agora',
    microtexto: 'Sem fidelização',
    popular: false,
  },
  {
    id: 'pro',
    nome: 'DSICOLA PRO',
    tagline: 'Reduza erros administrativos em tempo real',
    precoMensal: 650000,
    precoAnual: 6240000,
    limites: [
      'Até 2.000 alunos',
      '15 utilizadores administrativos',
      'Módulo Académico completo',
      'Módulo Financeiro',
      'Business Intelligence',
      'Emissão de documentos',
      'Comunicados e notificações',
      'Relatórios avançados',
    ],
    multiCampus: true,
    cta: 'Começar agora',
    microtexto: 'Ativação imediata',
    popular: true,
  },
  {
    id: 'enterprise',
    nome: 'DSICOLA ENTERPRISE',
    tagline: 'Acompanhe tudo em tempo real',
    precoMensal: 1200000,
    precoAnual: 11520000,
    limites: [
      'Alunos ilimitados',
      'Utilizadores ilimitados',
      'Todos os módulos incluídos',
      'Financeiro + RH',
      'BI e integração de dados',
      'Suporte prioritário',
      'Multi-campus',
    ],
    multiCampus: true,
    cta: 'Falar com consultor',
    microtexto: 'Plano personalizado',
    popular: false,
  },
];

export const CHAVE_PLANOS_LANDING = 'planos_landing_json';
