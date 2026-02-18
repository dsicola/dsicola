import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SmartSearch } from '@/components/common/SmartSearch';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { profilesApi, funcionariosApi, historicoRhApi, usersApi } from '@/services/api';
import { Camera, X, Landmark } from 'lucide-react';
import { COUNTRIES, getProvincesByCountry, getMunicipiosByProvince } from '@/utils/countries-provinces';
import { PasswordStrengthIndicator, isPasswordStrong } from '@/components/auth/PasswordStrengthIndicator';

interface FuncionarioFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funcionario: any | null;
  departamentos: { id: string; nome: string }[];
  cargos: { id: string; nome: string; salario_base: number | null }[];
  onSuccess: () => void;
  mode?: 'FUNCIONARIO' | 'PROFESSOR'; // Novo prop para diferenciar o modo
}

/** Perfis organizados por departamento - ao cadastrar funcionário, admin escolhe o perfil */
const SYSTEM_ROLES = [
  { value: 'RH', label: 'RH (Recursos Humanos)', departamento: 'Recursos Humanos' },
  { value: 'FINANCEIRO', label: 'Financeiro', departamento: 'Finanças' },
  { value: 'SECRETARIA', label: 'Secretaria', departamento: 'Administrativo' },
  { value: 'POS', label: 'Ponto de Venda', departamento: 'Finanças' },
  { value: 'PROFESSOR', label: 'Professor', departamento: 'Acadêmico' },
  { value: 'ADMIN', label: 'Administrador', departamento: 'Acesso total' },
];

export const FuncionarioFormDialog: React.FC<FuncionarioFormDialogProps> = ({
  open,
  onOpenChange,
  funcionario,
  departamentos,
  cargos,
  onSuccess,
  mode = 'FUNCIONARIO',
}) => {
  const { user } = useAuth();
  const { instituicaoId } = useInstituicao();
  const [isLoading, setIsLoading] = useState(false);
  const [isNewUser, setIsNewUser] = useState(true);
  const [existingUsers, setExistingUsers] = useState<any[]>([]);
  
  // Fetch complete funcionario data when editing (only if funcionario has an id)
  const { data: funcionarioData, isLoading: isLoadingFuncionario } = useQuery({
    queryKey: ['funcionario', funcionario?.id],
    queryFn: async () => {
      if (!funcionario?.id) return null;
      return await funcionariosApi.getById(funcionario.id);
    },
    enabled: !!funcionario?.id && open,
  });

  const [formData, setFormData] = useState({
    nome_completo: '',
    email: '',
    telefone: '',
    numero_identificacao: '',
    data_nascimento: '',
    morada: '',
    cidade: '',
    pais: '',
    provincia: '',
    municipio: '',
    nome_pai: '',
    nome_mae: '',
    foto_url: '',
    grau_academico: '',
    grau_academico_outro: '',
    password: '',
    user_id: '',
    departamento_id: '',
    cargo_id: '',
    salario: 0,
    data_admissao: new Date().toISOString().split('T')[0],
    data_fim_contrato: '',
    tipo_contrato: 'Efetivo',
    carga_horaria: '8h/dia',
    status: 'Ativo',
    observacoes: '',
    has_system_access: false,
    system_role: '',
    iban: '',
    nib: '',
    banco: '',
    numero_conta: '',
    titular_conta: '',
  });
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [fotoError, setFotoError] = useState<string | null>(null);

  // Use funcionarioData (from API) instead of funcionario prop when editing
  const currentFuncionario = funcionarioData || funcionario;

  useEffect(() => {
    // Se tem funcionario com id (edição de funcionario existente)
    if (currentFuncionario && currentFuncionario.id && open) {
      setFormData({
        nome_completo: currentFuncionario.profiles?.nome_completo || currentFuncionario.nome_completo || '',
        email: currentFuncionario.profiles?.email || currentFuncionario.email || '',
        telefone: currentFuncionario.profiles?.telefone || currentFuncionario.telefone || '',
        numero_identificacao: currentFuncionario.profiles?.numero_identificacao || currentFuncionario.numero_identificacao || '',
        data_nascimento: currentFuncionario.data_nascimento || '',
        morada: currentFuncionario.morada || '',
        cidade: currentFuncionario.cidade || '',
        pais: currentFuncionario.pais || '',
        provincia: currentFuncionario.provincia || '',
        municipio: currentFuncionario.municipio || '',
        nome_pai: currentFuncionario.nome_pai || '',
        nome_mae: currentFuncionario.nome_mae || '',
        foto_url: currentFuncionario.foto_url || '',
        grau_academico: currentFuncionario.grau_academico || '',
        grau_academico_outro: currentFuncionario.grau_academico_outro || '',
        password: '',
        user_id: currentFuncionario.user_id || '',
        departamento_id: currentFuncionario.departamento_id || '',
        cargo_id: currentFuncionario.cargo_id || '',
        salario: currentFuncionario.salario || currentFuncionario.salario_base || 0,
        data_admissao: currentFuncionario.data_admissao || new Date().toISOString().split('T')[0],
        data_fim_contrato: (currentFuncionario as any).data_fim_contrato || '',
        tipo_contrato: (currentFuncionario as any).tipo_contrato || 'Efetivo',
        carga_horaria: (currentFuncionario as any).carga_horaria || '8h/dia',
        status: currentFuncionario.status || 'Ativo',
        observacoes: (currentFuncionario as any).observacoes || '',
        has_system_access: !!currentFuncionario.user_id,
        system_role: mode === 'PROFESSOR' ? 'PROFESSOR' : '',
        iban: currentFuncionario.iban || '',
        nib: currentFuncionario.nib || '',
        banco: currentFuncionario.banco || '',
        numero_conta: currentFuncionario.numero_conta || '',
        titular_conta: currentFuncionario.titular_conta || '',
      });
      setFotoPreview(currentFuncionario.foto_url || null);
      setIsNewUser(false);
    } 
    // Se tem funcionario sem id mas com user_id (User existente sem Funcionario - vai criar)
    else if (funcionario && funcionario.user_id && !funcionario.id && open) {
      // Buscar dados do User para preencher o formulário
      setFormData({
        nome_completo: funcionario.nome_completo || '',
        email: funcionario.email || '',
        telefone: funcionario.telefone || '',
        numero_identificacao: funcionario.numero_identificacao || '',
        data_nascimento: funcionario.data_nascimento || '',
        morada: funcionario.morada || '',
        cidade: funcionario.cidade || '',
        pais: funcionario.pais || '',
        provincia: funcionario.provincia || '',
        municipio: funcionario.municipio || '',
        nome_pai: funcionario.nome_pai || '',
        nome_mae: funcionario.nome_mae || '',
        foto_url: funcionario.foto_url || '',
        grau_academico: funcionario.grau_academico || '',
        grau_academico_outro: funcionario.grau_academico_outro || '',
        password: '',
        user_id: funcionario.user_id,
        departamento_id: funcionario.departamento_id || '',
        cargo_id: funcionario.cargo_id || '',
        salario: funcionario.salario || funcionario.salario_base || 0,
        data_admissao: funcionario.data_admissao || new Date().toISOString().split('T')[0],
        data_fim_contrato: (funcionario as any).data_fim_contrato || '',
        tipo_contrato: (funcionario as any).tipo_contrato || 'Efetivo',
        carga_horaria: (funcionario as any).carga_horaria || '8h/dia',
        status: funcionario.status || 'Ativo',
        observacoes: (funcionario as any).observacoes || '',
        has_system_access: true,
        system_role: mode === 'PROFESSOR' ? 'PROFESSOR' : '',
        iban: funcionario.iban || '',
        nib: funcionario.nib || '',
        banco: funcionario.banco || '',
        numero_conta: funcionario.numero_conta || '',
        titular_conta: funcionario.titular_conta || '',
      });
      setFotoPreview(funcionario.foto_url || null);
      setIsNewUser(false);
    }
    // Novo cadastro
    else if (!funcionario && open) {
      resetForm();
      if (mode === 'PROFESSOR') {
        // Forçar modo professor: sempre novo usuário com acesso ao sistema
        setIsNewUser(true);
        setFormData(prev => ({
          ...prev,
          has_system_access: true,
          system_role: 'PROFESSOR',
        }));
      } else {
        fetchExistingUsers();
      }
    }
  }, [currentFuncionario, funcionario, open, mode]);

  const resetForm = () => {
    setFormData({
      nome_completo: '',
      email: '',
      telefone: '',
      numero_identificacao: '',
      data_nascimento: '',
      morada: '',
      cidade: '',
      pais: '',
      provincia: '',
      nome_pai: '',
      nome_mae: '',
      foto_url: '',
      grau_academico: '',
      grau_academico_outro: '',
      password: '',
      user_id: '',
      departamento_id: '',
      cargo_id: '',
      salario: 0,
      data_admissao: new Date().toISOString().split('T')[0],
      data_fim_contrato: '',
      tipo_contrato: 'Efetivo',
      carga_horaria: '8h/dia',
      status: 'Ativo',
      observacoes: '',
      has_system_access: false,
      system_role: '',
      iban: '',
      nib: '',
      banco: '',
      numero_conta: '',
      titular_conta: '',
    });
    setFotoPreview(null);
    setIsNewUser(true);
  };

  const fetchExistingUsers = async () => {
    try {
      // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
      // O backend usa req.user.instituicaoId do JWT token automaticamente
      const profiles = await profilesApi.getAll();
      const funcionariosData = await funcionariosApi.getAll();
      
      const funcUserIds = funcionariosData?.map((f: any) => f.user_id) || [];
      setExistingUsers(profiles.filter((u: any) => !funcUserIds.includes(u.id)));
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleCargoChange = (cargoId: string) => {
    const cargo = cargos.find(c => c.id === cargoId);
    setFormData(prev => ({
      ...prev,
      cargo_id: cargoId,
      salario: cargo?.salario_base || prev.salario,
    }));
  };

  const handleExistingUserSelect = (userId: string) => {
    const selectedUser = existingUsers.find(u => u.id === userId);
    if (selectedUser) {
      setFormData(prev => ({
        ...prev,
        user_id: userId,
        nome_completo: selectedUser.nome_completo,
        email: selectedUser.email,
      }));
    }
  };

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tipo de arquivo
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        const errorMsg = "Apenas imagens JPEG, PNG e WEBP são permitidas";
        setFotoError(errorMsg);
        toast.error(errorMsg);
        e.target.value = ''; // Limpar input
        return;
      }

      // Validar tamanho (2MB máximo)
      const maxSize = 2 * 1024 * 1024; // 2MB em bytes
      if (file.size > maxSize) {
        const errorMsg = "A foto selecionada é muito grande. O tamanho máximo permitido é 2MB.";
        setFotoError(errorMsg);
        toast.error(errorMsg);
        e.target.value = ''; // Limpar input
        return;
      }

      // Se passar nas validações, limpar erro e processar arquivo
      setFotoError(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setFormData(prev => ({ ...prev, foto_url: base64String }));
        setFotoPreview(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveFoto = () => {
    setFormData(prev => ({ ...prev, foto_url: '' }));
    setFotoPreview(null);
    setFotoError(null); // Limpar erro ao remover foto
  };

  const handleSubmit = async () => {
    setIsLoading(true);

    try {
      // Validar foto se houver erro
      if (fotoError) {
        toast.error("Corrija o erro na foto antes de continuar");
        setIsLoading(false);
        return;
      }

      // VALIDAÇÃO: Funcionário é SEMPRE pessoa física
      // Bloquear apenas indicadores MUITO específicos de pessoa jurídica
      // (removemos palavras genéricas que podem aparecer em nomes de pessoas)
      if (formData.nome_completo) {
        const nomeUpper = formData.nome_completo.toUpperCase().trim();
        // Apenas indicadores muito específicos de PJ que raramente aparecem em nomes de pessoas
        const indicadoresPJEspecificos = [
          ' LTDA', ' LTDA.', ' EIRELI', ' ME ', ' EPP ', ' SA ', ' S.A.', ' S/A',
          'SOCIEDADE ', 'SOCIEDADE ANONIMA', 'SOCIEDADE ANÔNIMA'
        ];
        
        // Verificar se algum indicador aparece como palavra completa (não substring)
        // Focar especialmente no final do nome onde geralmente ficam os indicadores de PJ
        const nomeWords = nomeUpper.split(/\s+/);
        const ultimaPalavra = nomeWords[nomeWords.length - 1];
        const indicadoresFinais = ['LTDA', 'LTDA.', 'EIRELI', 'ME', 'EPP', 'SA', 'S.A.', 'S/A'];
        
        // Verificar se termina com indicador de PJ
        if (indicadoresFinais.includes(ultimaPalavra)) {
          toast.error(
            `Funcionários são pessoas físicas. O nome termina com indicador de pessoa jurídica (${ultimaPalavra}). Empresas terceirizadas devem ser cadastradas como Fornecedores (pessoa jurídica).`,
            { duration: 6000 }
          );
          setIsLoading(false);
          return;
        }
        
        // Verificar se contém indicadores específicos como palavras completas
        const indicadorEncontrado = indicadoresPJEspecificos.find(ind => {
          const trimmed = ind.trim();
          // Verificar se aparece como palavra completa (com espaços ou no final)
          const regex = new RegExp(`\\b${trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
          return regex.test(nomeUpper) || nomeUpper.endsWith(trimmed);
        });
        
        if (indicadorEncontrado) {
          toast.error(
            `Funcionários são pessoas físicas. O nome contém indicadores de pessoa jurídica. Empresas terceirizadas devem ser cadastradas como Fornecedores (pessoa jurídica).`,
            { duration: 6000 }
          );
          setIsLoading(false);
          return;
        }
      }

      // Validação de CNPJ: apenas para formato brasileiro específico (XX.XXX.XXX/XXXX-XX)
      // Não bloquear números com 14 dígitos genéricos (pode ser BI angolano que tem letras)
      if (formData.numero_identificacao) {
        const numeroStr = formData.numero_identificacao;
        const numeroLimpo = numeroStr.replace(/\D/g, '');
        
        // Verificar formato específico de CNPJ brasileiro: XX.XXX.XXX/XXXX-XX
        const formatoCNPJ = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(numeroStr);
        
        // Ou 14 dígitos seguidos sem letras (CNPJ sem formatação)
        // BI angolano tem letras (ex: 000000000LA000), então não será bloqueado
        const cnpjSemFormatacao = numeroLimpo.length === 14 && 
                                  /^\d+$/.test(numeroLimpo) && 
                                  !/[A-Za-z]/.test(numeroStr);
        
        if (formatoCNPJ || cnpjSemFormatacao) {
          toast.error(
            'Funcionários são pessoas físicas. O número de identificação fornecido parece ser um CNPJ (formato brasileiro). Empresas terceirizadas devem ser cadastradas como Fornecedores (pessoa jurídica).',
            { duration: 6000 }
          );
          setIsLoading(false);
          return;
        }
      }

      let userId = formData.user_id;

      // If creating a new user
      if (isNewUser && !funcionario) {
        if (!formData.nome_completo || !formData.email) {
          toast.error('Nome e email são obrigatórios');
          setIsLoading(false);
          return;
        }

        if (formData.has_system_access && formData.password.length < 6) {
          toast.error('Senha deve ter pelo menos 6 caracteres');
          setIsLoading(false);
          return;
        }

        // Create user via API if has system access
        if (formData.has_system_access || mode === 'PROFESSOR') {
          if (!formData.numero_identificacao) {
            toast.error('Número de identificação (BI) é obrigatório');
            setIsLoading(false);
            return;
          }
          
          // Forçar role PROFESSOR se modo professor
          const roleToUse = mode === 'PROFESSOR' ? 'PROFESSOR' : formData.system_role;
          
          // Validar senha forte para roles com acesso ao sistema
          const rolesExigemSenhaForte = ['PROFESSOR', 'ADMIN', 'SECRETARIA', 'POS', 'RH', 'FINANCEIRO', 'SUPER_ADMIN'];
          if (rolesExigemSenhaForte.includes(roleToUse) && !isPasswordStrong(formData.password, false, roleToUse as any)) {
            toast.error('A senha deve conter pelo menos uma letra maiúscula e um caractere especial.');
            setIsLoading(false);
            return;
          }
          
          try {
            // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
            // O backend usa req.user.instituicaoId do JWT token automaticamente
            // Apenas SUPER_ADMIN pode especificar instituicaoId (backend valida)
            const userData: any = {
              email: formData.email,
              password: formData.password,
              nomeCompleto: formData.nome_completo,
              role: roleToUse,
              telefone: formData.telefone || undefined,
              numeroIdentificacao: formData.numero_identificacao || undefined,
            };
            // SUPER_ADMIN pode especificar instituicaoId (exceção controlada)
            const result = await usersApi.create(userData);
            userId = result?.id || result?.user?.id;
          } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao criar usuário');
            setIsLoading(false);
            return;
          }
        } else {
          // Just create a profile without auth user
          try {
            // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
            // O backend usa req.user.instituicaoId do JWT token automaticamente
            const result = await usersApi.create({
              email: formData.email,
              password: crypto.randomUUID(), // Temporary password
              nomeCompleto: formData.nome_completo,
              role: 'SECRETARIA', // Backend não tem FUNCIONARIO; SECRETARIA é o equivalente para staff administrativo
            });
            userId = result?.id || result?.user?.id;
          } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao criar perfil');
            setIsLoading(false);
            return;
          }
        }
      }

      const funcionarioData: any = {};
      
      // Only include userId if it's being set/changed
      if (userId) {
        funcionarioData.userId = userId;
      }
      
      // Include fields that exist in the backend schema
      if (formData.departamento_id) funcionarioData.departamentoId = formData.departamento_id;
      if (formData.cargo_id) funcionarioData.cargoId = formData.cargo_id;
      if (formData.salario) funcionarioData.salario = formData.salario;
      if (formData.data_admissao) funcionarioData.dataAdmissao = formData.data_admissao;
      if (formData.status) funcionarioData.status = formData.status;
      
      // Include nome and email when creating new (without userId) or updating funcionario fields
      // Note: If funcionario has userId, these fields come from User, but we still send them
      // to update the funcionario record if needed
      const funcionarioId = currentFuncionario?.id;
      if (!funcionarioId || !userId) {
        // When creating new or updating funcionario without userId, include these fields
        if (formData.nome_completo) funcionarioData.nomeCompleto = formData.nome_completo;
        if (formData.email) funcionarioData.email = formData.email;
        if (formData.telefone !== undefined) funcionarioData.telefone = formData.telefone || null;
        if (formData.numero_identificacao !== undefined) funcionarioData.numeroIdentificacao = formData.numero_identificacao || null;
      }
      
      // Include new fields (always send, even if empty)
      if (formData.data_nascimento) funcionarioData.dataNascimento = formData.data_nascimento;
      funcionarioData.morada = formData.morada || null;
      funcionarioData.cidade = formData.cidade || null;
      funcionarioData.pais = formData.pais || null;
      funcionarioData.provincia = formData.provincia || null;
      funcionarioData.municipio = formData.municipio || null;
      funcionarioData.nomePai = formData.nome_pai || null;
      funcionarioData.nomeMae = formData.nome_mae || null;
      funcionarioData.fotoUrl = formData.foto_url || null;
      funcionarioData.grauAcademico = formData.grau_academico || null;
      funcionarioData.grauAcademicoOutro = formData.grau_academico_outro || null;

      // Coordenadas bancárias (para transferência de salário)
      funcionarioData.iban = formData.iban || null;
      funcionarioData.nib = formData.nib || null;
      funcionarioData.banco = formData.banco || null;
      funcionarioData.numeroConta = formData.numero_conta || null;
      funcionarioData.titularConta = formData.titular_conta || null;

      if (funcionarioId) {
        // Update
        await funcionariosApi.update(funcionarioId, funcionarioData);

        // Log history
        await historicoRhApi.create({
          funcionarioId: funcionarioId,
          tipoAlteracao: 'Atualização',
          observacao: 'Dados do funcionário atualizados',
        });

        toast.success('Funcionário atualizado!');
      } else {
        // Insert
        await funcionariosApi.create(funcionarioData);
        toast.success('Funcionário cadastrado!');
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error:', error);
      // Exibir mensagem de erro mais clara do backend
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          error.message || 
                          'Erro ao salvar funcionário';
      toast.error(errorMessage, { duration: 6000 });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {currentFuncionario 
              ? (mode === 'PROFESSOR' ? 'Editar Professor' : 'Editar Funcionário')
              : (mode === 'PROFESSOR' ? 'Novo Professor' : 'Novo Funcionário')
            }
          </DialogTitle>
          <DialogDescription>
            {currentFuncionario 
              ? (mode === 'PROFESSOR' ? 'Atualize os dados do professor' : 'Atualize os dados do funcionário')
              : (mode === 'PROFESSOR' ? 'Cadastre um novo professor na instituição' : 'Cadastre um novo funcionário na instituição')
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* ENTERPRISE: Aviso educativo sobre pessoa física vs jurídica */}
          {!currentFuncionario && mode !== 'PROFESSOR' && (
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                    ⚠️ Funcionários são SEMPRE pessoas físicas
                  </p>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Este cadastro é exclusivo para <strong>pessoas físicas</strong> com vínculo direto de trabalho. 
                    <br />
                    <strong>NÃO cadastre:</strong> empresas, razão social, NIF empresarial ou terceirizados.
                    <br />
                    <strong>Para cadastrar:</strong> Empresas terceirizadas, prestadores de serviço e fornecedores devem ser cadastrados na aba <strong>"Fornecedores / Prestadores de Serviço"</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}
          {/* User Selection (only for new, and not in PROFESSOR mode) */}
          {!currentFuncionario && mode !== 'PROFESSOR' && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Label>Tipo de cadastro:</Label>
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant={isNewUser ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setIsNewUser(true)}
                  >
                    Novo usuário
                  </Button>
                  <Button
                    type="button"
                    variant={!isNewUser ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setIsNewUser(false)}
                  >
                    Usuário existente
                  </Button>
                </div>
              </div>

              {!isNewUser && (
                <div className="space-y-2">
                  <Label>Selecionar usuário</Label>
                  <SmartSearch
                    placeholder="Digite o nome ou email do usuário..."
                    value={existingUsers.find((u) => u.id === formData.user_id)?.nome_completo || ''}
                    selectedId={formData.user_id || undefined}
                    onSelect={(item) => {
                      if (item) {
                        handleExistingUserSelect(item.id);
                      } else {
                        setFormData((prev) => ({ ...prev, user_id: '' }));
                      }
                    }}
                    onClear={() => setFormData((prev) => ({ ...prev, user_id: '' }))}
                    searchFn={async (term) => {
                      const search = String(term ?? "").toLowerCase().trim();
                      return existingUsers
                        .filter(
                          (u) =>
                            String(u.nome_completo ?? "").toLowerCase().includes(search) ||
                            String(u.email ?? "").toLowerCase().includes(search)
                        )
                        .slice(0, 15)
                        .map((u) => ({
                          id: u.id,
                          nome: u.nome_completo || u.email || '',
                          nomeCompleto: u.nome_completo || '',
                          nome_completo: u.nome_completo || '',
                          email: u.email || '',
                        }));
                    }}
                    minSearchLength={1}
                    emptyMessage="Nenhum usuário disponível (todos já têm vínculo com funcionário)"
                    silent
                  />
                </div>
              )}
            </div>
          )}

          {/* User Info */}
          {(isNewUser || currentFuncionario) && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome Completo *</Label>
                <Input
                  value={formData.nome_completo || ''}
                  onChange={(e) => setFormData({ ...formData, nome_completo: e.target.value })}
                  disabled={!!currentFuncionario?.user_id}
                />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={!!currentFuncionario?.user_id}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={formData.telefone || ''}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  disabled={!!currentFuncionario?.user_id}
                />
              </div>
              <div className="space-y-2">
                <Label>Nº de Identificação (BI) *</Label>
                <Input
                  value={formData.numero_identificacao || ''}
                  onChange={(e) => setFormData({ ...formData, numero_identificacao: e.target.value })}
                  placeholder="Ex: 000000000LA000"
                  disabled={!!currentFuncionario?.user_id}
                />
              </div>
            </div>
          )}

          {/* Additional Personal Information */}
          {(isNewUser || currentFuncionario) && (
            <div className="space-y-4">
              <h3 className="font-medium">Informações Pessoais Adicionais</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data de Nascimento</Label>
                  <Input
                    type="date"
                    value={formData.data_nascimento || ''}
                    onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nome do Pai</Label>
                  <Input
                    value={formData.nome_pai || ''}
                    onChange={(e) => setFormData({ ...formData, nome_pai: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nome da Mãe</Label>
                  <Input
                    value={formData.nome_mae || ''}
                    onChange={(e) => setFormData({ ...formData, nome_mae: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Grau Académico</Label>
                  <Select
                    value={formData.grau_academico || ''}
                    onValueChange={(value) => {
                      setFormData({ 
                        ...formData, 
                        grau_academico: value,
                        // Clear "outro" field if not selecting "Outro"
                        grau_academico_outro: value === 'Outro' ? formData.grau_academico_outro : ''
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o grau académico" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ensino Médio">Ensino Médio</SelectItem>
                      <SelectItem value="Técnico">Técnico</SelectItem>
                      <SelectItem value="Bacharelato">Bacharelato</SelectItem>
                      <SelectItem value="Licenciatura">Licenciatura</SelectItem>
                      <SelectItem value="Pós-graduação">Pós-graduação</SelectItem>
                      <SelectItem value="Mestrado">Mestrado</SelectItem>
                      <SelectItem value="Doutoramento">Doutoramento</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.grau_academico === 'Outro' && (
                  <div className="space-y-2">
                    <Label>Especifique o Grau Académico</Label>
                    <Input
                      value={formData.grau_academico_outro || ''}
                      onChange={(e) => setFormData({ ...formData, grau_academico_outro: e.target.value })}
                      placeholder="Digite o grau académico"
                    />
                  </div>
                )}
              </div>
              
              {/* Address Fields */}
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label>Endereço</Label>
                  <Input
                    value={formData.morada || ''}
                    onChange={(e) => setFormData({ ...formData, morada: e.target.value })}
                    placeholder="Rua, número, bairro"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input
                      value={formData.cidade || ''}
                      onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>País</Label>
                    <Select
                      value={formData.pais ?? ''}
                      onValueChange={(value) => {
                        setFormData({ ...formData, pais: value, provincia: '', municipio: '' }); // Reset provincia and municipio when country changes
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o país" />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((country) => (
                          <SelectItem key={country} value={country}>
                            {country}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Província</Label>
                    <Select
                      value={formData.provincia ?? ''}
                      onValueChange={(value) => setFormData({ ...formData, provincia: value, municipio: '' })} // Reset municipio when province changes
                      disabled={!formData.pais}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={formData.pais ? "Selecione a província" : "Selecione primeiro o país"} />
                      </SelectTrigger>
                      <SelectContent>
                        {formData.pais && getProvincesByCountry(formData.pais).map((province) => (
                          <SelectItem key={province} value={province}>
                            {province}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Município</Label>
                    <Select
                      value={formData.municipio ?? ''}
                      onValueChange={(value) => setFormData({ ...formData, municipio: value })}
                      disabled={!formData.pais || !formData.provincia}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={formData.pais && formData.provincia ? "Selecione o município" : formData.pais ? "Selecione primeiro a província" : "Selecione primeiro o país"} />
                      </SelectTrigger>
                      <SelectContent>
                        {formData.pais && formData.provincia && getMunicipiosByProvince(formData.pais, formData.provincia).map((municipio) => (
                          <SelectItem key={municipio} value={municipio}>
                            {municipio}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Photo Upload */}
              <div className="space-y-2">
                <Label>Foto</Label>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={fotoPreview || undefined} alt="Foto" />
                      <AvatarFallback>
                        {formData.nome_completo ? formData.nome_completo.charAt(0).toUpperCase() : 'F'}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={handleFotoChange}
                      className="hidden"
                      id="foto-upload"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById('foto-upload')?.click()}
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        {fotoPreview ? 'Alterar Foto' : 'Adicionar Foto'}
                      </Button>
                      {fotoPreview && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleRemoveFoto}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Remover
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Apenas imagens JPEG, PNG e WEBP. Máximo 2MB.
                    </p>
                    {fotoError && (
                      <p className="text-xs text-red-500 mt-1">
                        {fotoError}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* System Access (only for new, hidden if PROFESSOR mode - always has access) */}
          {!currentFuncionario && isNewUser && mode !== 'PROFESSOR' && (
            <div className="space-y-4 p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Acesso ao Sistema</Label>
                  <p className="text-sm text-muted-foreground">
                    Permitir que este funcionário faça login no sistema
                  </p>
                </div>
                <Switch
                  checked={formData.has_system_access}
                  onCheckedChange={(checked) => setFormData({ ...formData, has_system_access: checked })}
                />
              </div>

              {formData.has_system_access && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Senha *</Label>
                    <Input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Perfil (por departamento) *</Label>
                    <Select value={formData.system_role} onValueChange={(v) => setFormData({ ...formData, system_role: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {SYSTEM_ROLES.map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* System Access for PROFESSOR mode (always visible, always enabled) */}
          {!currentFuncionario && mode === 'PROFESSOR' && (
            <div className="space-y-4 p-4 border rounded-lg bg-primary/5">
              <div className="space-y-2">
                <Label>Senha do Professor *</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                />
                {formData.password && (
                  <PasswordStrengthIndicator 
                    password={formData.password} 
                    userRole={mode === 'PROFESSOR' ? 'PROFESSOR' : (formData.system_role as any)}
                  />
                )}
                <p className="text-sm text-muted-foreground">
                  O professor terá acesso ao sistema com a função de Professor
                </p>
              </div>
            </div>
          )}

          {/* Employment Info */}
          <div className="space-y-4">
            <h3 className="font-medium">Dados do Vínculo</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Departamento</Label>
                <SmartSearch
                  placeholder="Digite o nome do departamento..."
                  value={departamentos.find((d) => d.id === formData.departamento_id)?.nome || ''}
                  selectedId={formData.departamento_id || undefined}
                  onSelect={(item) =>
                    setFormData({ ...formData, departamento_id: item ? item.id : '' })
                  }
                  onClear={() => setFormData({ ...formData, departamento_id: '' })}
                  searchFn={async (term) => {
                    const search = String(term ?? "").toLowerCase().trim();
                    return departamentos
                      .filter((d) => String(d.nome ?? "").toLowerCase().includes(search))
                      .slice(0, 15)
                      .map((d) => ({
                        id: d.id,
                        nome: d.nome || '',
                        nomeCompleto: d.nome || '',
                        complemento: d.descricao || '',
                      }));
                  }}
                  minSearchLength={1}
                  emptyMessage="Nenhum departamento encontrado"
                  silent
                />
              </div>
              <div className="space-y-2">
                <Label>Cargo</Label>
                <SmartSearch
                  placeholder="Digite o nome do cargo..."
                  value={cargos.find((c) => c.id === formData.cargo_id)?.nome || ''}
                  selectedId={formData.cargo_id || undefined}
                  onSelect={(item) => {
                    if (item) handleCargoChange(item.id);
                    else setFormData((prev) => ({ ...prev, cargo_id: '', salario: 0 }));
                  }}
                  onClear={() =>
                    setFormData((prev) => ({ ...prev, cargo_id: '', salario: 0 }))
                  }
                  searchFn={async (term) => {
                    const search = String(term ?? "").toLowerCase().trim();
                    return cargos
                      .filter((c) => String(c.nome ?? "").toLowerCase().includes(search))
                      .slice(0, 15)
                      .map((c) => ({
                        id: c.id,
                        nome: c.nome || '',
                        nomeCompleto: c.nome || '',
                        complemento: c.salario_base
                          ? `Salário base: ${c.salario_base}`
                          : '',
                      }));
                  }}
                  minSearchLength={1}
                  emptyMessage="Nenhum cargo encontrado"
                  silent
                />
              </div>
              <div className="space-y-2">
                <Label>Salário</Label>
                <Input
                  type="number"
                  value={formData.salario ?? 0}
                  onChange={(e) => setFormData({ ...formData, salario: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Data de Admissão</Label>
                <Input
                  type="date"
                  value={formData.data_admissao || ''}
                  onChange={(e) => setFormData({ ...formData, data_admissao: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Contrato</Label>
                <Select value={formData.tipo_contrato} onValueChange={(v) => setFormData({ ...formData, tipo_contrato: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Efetivo">Efetivo</SelectItem>
                    <SelectItem value="Temporário">Temporário</SelectItem>
                    <SelectItem value="Estágio">Estágio</SelectItem>
                    <SelectItem value="Prestador">Prestador de Serviços</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Carga Horária</Label>
                <Select value={formData.carga_horaria} onValueChange={(v) => setFormData({ ...formData, carga_horaria: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4h/dia">4h/dia</SelectItem>
                    <SelectItem value="6h/dia">6h/dia</SelectItem>
                    <SelectItem value="8h/dia">8h/dia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data Fim Contrato</Label>
                <Input
                  type="date"
                  value={formData.data_fim_contrato || ''}
                  onChange={(e) => setFormData({ ...formData, data_fim_contrato: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status || 'Ativo'} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ativo">Ativo</SelectItem>
                    <SelectItem value="Inativo">Inativo</SelectItem>
                    <SelectItem value="Afastado">Afastado</SelectItem>
                    <SelectItem value="Férias">Férias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Coordenadas Bancárias - para transferência de salário */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-medium flex items-center gap-2">
                <Landmark className="h-5 w-5 text-primary" />
                Coordenadas Bancárias
              </h3>
              <p className="text-sm text-muted-foreground">
                Dados para transferência de salário (folha de pagamento). Preenchimento opcional.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>Titular da Conta</Label>
                  <Input
                    value={formData.titular_conta || ''}
                    onChange={(e) => setFormData({ ...formData, titular_conta: e.target.value })}
                    placeholder="Nome do titular da conta bancária"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Banco</Label>
                  <Input
                    value={formData.banco || ''}
                    onChange={(e) => setFormData({ ...formData, banco: e.target.value })}
                    placeholder="Ex: BFA, BAI, BIC..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Número da Conta</Label>
                  <Input
                    value={formData.numero_conta || ''}
                    onChange={(e) => setFormData({ ...formData, numero_conta: e.target.value })}
                    placeholder="Número da conta"
                  />
                </div>
                <div className="space-y-2">
                  <Label>IBAN</Label>
                  <Input
                    value={formData.iban || ''}
                    onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                    placeholder="IBAN (opcional)"
                  />
                </div>
                <div className="space-y-2">
                  <Label>NIB</Label>
                  <Input
                    value={formData.nib || ''}
                    onChange={(e) => setFormData({ ...formData, nib: e.target.value })}
                    placeholder="NIB - Nº Identificação Bancária"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.observacoes || ''}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Observações adicionais..."
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={
              isLoading || 
              isLoadingFuncionario || 
              !!fotoError ||
              // Validar senha apenas se foi preenchida (não vazia)
              (mode === 'PROFESSOR' && formData.password.trim() !== '' && !isPasswordStrong(formData.password, false, 'PROFESSOR')) ||
              (formData.has_system_access && formData.system_role && ['PROFESSOR', 'ADMIN', 'SECRETARIA', 'POS', 'RH', 'FINANCEIRO', 'SUPER_ADMIN'].includes(formData.system_role) && formData.password.trim() !== '' && !isPasswordStrong(formData.password, false, formData.system_role as any))
            }
          >
            {isLoading ? 'Salvando...' : isLoadingFuncionario ? 'Carregando...' : currentFuncionario ? 'Atualizar' : 'Cadastrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
