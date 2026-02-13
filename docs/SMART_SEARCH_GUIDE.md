# Guia de Uso - SmartSearch Component

## Visão Geral

O `SmartSearch` é um componente reutilizável de busca inteligente (autocomplete) que padroniza a experiência de seleção de entidades em todo o sistema DSICOLA.

## Características

- ✅ Busca dinâmica com debounce (300ms padrão)
- ✅ Lista flutuante de resultados (máximo 10)
- ✅ Seleção com um clique
- ✅ Mensagem de confirmação automática
- ✅ Suporte a limpar seleção
- ✅ Loading states
- ✅ Tratamento de erros
- ✅ Filtragem automática por `instituicaoId` (multi-tenant)

## Instalação e Importação

```typescript
import { SmartSearch } from '@/components/common/SmartSearch';
import { useAlunoSearch, useProfessorSearch, useFuncionarioSearch } from '@/hooks/useSmartSearch';
```

## Uso Básico

### Exemplo 1: Buscar Aluno

```typescript
import { SmartSearch } from '@/components/common/SmartSearch';
import { useAlunoSearch } from '@/hooks/useSmartSearch';

function MeuComponente() {
  const { searchAlunos } = useAlunoSearch();
  const [alunoId, setAlunoId] = useState<string | null>(null);
  const [alunoNome, setAlunoNome] = useState<string>('');

  return (
    <div className="space-y-2">
      <Label>Aluno *</Label>
      <SmartSearch
        placeholder="Digite o nome do aluno ou número de BI..."
        value={alunoNome}
        selectedId={alunoId || undefined}
        onSelect={(item) => {
          if (item) {
            setAlunoId(item.id);
            setAlunoNome(item.nomeCompleto || item.nome_completo || '');
          } else {
            setAlunoId(null);
            setAlunoNome('');
          }
        }}
        searchFn={searchAlunos}
        required
      />
    </div>
  );
}
```

### Exemplo 2: Buscar Professor

```typescript
import { SmartSearch } from '@/components/common/SmartSearch';
import { useProfessorSearch } from '@/hooks/useSmartSearch';

function MeuComponente() {
  const { searchProfessores } = useProfessorSearch();
  const [professorId, setProfessorId] = useState<string | null>(null);

  return (
    <SmartSearch
      placeholder="Digite o nome do professor..."
      selectedId={professorId || undefined}
      onSelect={(item) => setProfessorId(item?.id || null)}
      searchFn={searchProfessores}
    />
  );
}
```

### Exemplo 3: Buscar Funcionário

```typescript
import { SmartSearch } from '@/components/common/SmartSearch';
import { useFuncionarioSearch } from '@/hooks/useSmartSearch';

function MeuComponente() {
  const { searchFuncionarios } = useFuncionarioSearch();
  const [funcionarioId, setFuncionarioId] = useState<string | null>(null);

  return (
    <SmartSearch
      placeholder="Digite o nome do funcionário..."
      selectedId={funcionarioId || undefined}
      onSelect={(item) => setFuncionarioId(item?.id || null)}
      searchFn={searchFuncionarios}
    />
  );
}
```

### Exemplo 4: Busca Customizada

```typescript
import { SmartSearch, SmartSearchItem } from '@/components/common/SmartSearch';
import { useCustomSearch } from '@/hooks/useSmartSearch';

function MeuComponente() {
  const { search } = useCustomSearch(
    async (searchTerm: string) => {
      // Sua função de busca customizada
      const response = await minhaApi.buscar({ search: searchTerm });
      return response.data;
    },
    (item: any): SmartSearchItem => ({
      id: item.id,
      nome: item.nome,
      nomeCompleto: item.nomeCompleto,
      complemento: item.infoAdicional,
    })
  );

  return (
    <SmartSearch
      placeholder="Digite para buscar..."
      onSelect={(item) => console.log('Selecionado:', item)}
      searchFn={search}
    />
  );
}
```

## Props do SmartSearch

| Prop | Tipo | Obrigatório | Padrão | Descrição |
|------|------|-------------|--------|-----------|
| `placeholder` | `string` | Não | `"Digite para buscar..."` | Placeholder do input |
| `value` | `string` | Não | - | Valor inicial (nome do item selecionado) |
| `selectedId` | `string` | Não | - | ID do item selecionado |
| `onSelect` | `(item: SmartSearchItem \| null) => void` | ✅ Sim | - | Callback quando item é selecionado |
| `onClear` | `() => void` | Não | - | Callback quando seleção é limpa |
| `searchFn` | `(searchTerm: string) => Promise<SmartSearchItem[]>` | ✅ Sim | - | Função de busca |
| `minSearchLength` | `number` | Não | `2` | Mínimo de caracteres para buscar |
| `maxResults` | `number` | Não | `10` | Máximo de resultados |
| `debounceMs` | `number` | Não | `300` | Tempo de debounce em ms |
| `getDisplayName` | `(item) => string` | Não | - | Função para obter nome de exibição |
| `getSubtitle` | `(item) => string` | Não | - | Função para obter subtítulo |
| `emptyMessage` | `string` | Não | `"Nenhum resultado encontrado"` | Mensagem quando não há resultados |
| `loadingMessage` | `string` | Não | `"Buscando..."` | Mensagem durante loading |
| `disabled` | `boolean` | Não | `false` | Desabilitar input |
| `className` | `string` | Não | - | Classes CSS adicionais |
| `required` | `boolean` | Não | `false` | Campo obrigatório |
| `error` | `string` | Não | - | Mensagem de erro |

## Hooks Disponíveis

### `useAlunoSearch()`
Busca alunos da instituição atual.

```typescript
const { searchAlunos } = useAlunoSearch();
```

### `useProfessorSearch()`
Busca professores da instituição atual.

```typescript
const { searchProfessores } = useProfessorSearch();
```

### `useFuncionarioSearch()`
Busca funcionários ativos da instituição atual.

```typescript
const { searchFuncionarios } = useFuncionarioSearch();
```

### `useDisciplinaSearch()`
Busca disciplinas ativas da instituição atual.

```typescript
const { searchDisciplinas } = useDisciplinaSearch();
```

### `useTurmaSearch()`
Busca turmas da instituição atual.

```typescript
const { searchTurmas } = useTurmaSearch();
```

### `useCustomSearch<T>(searchFn, mapFn)`
Cria busca customizada para qualquer entidade.

```typescript
const { search } = useCustomSearch(
  async (term) => await minhaApi.buscar(term),
  (item) => ({ id: item.id, nome: item.nome })
);
```

## Interface SmartSearchItem

```typescript
interface SmartSearchItem {
  id: string;
  nome: string;
  nomeCompleto?: string;
  nome_completo?: string;
  email?: string;
  numeroIdentificacao?: string;
  numero_identificacao?: string;
  complemento?: string; // Info adicional customizada
  [key: string]: any; // Permite campos adicionais
}
```

## Comportamento

1. **Digitação**: Ao digitar, busca é acionada automaticamente após debounce
2. **Resultados**: Lista flutuante aparece abaixo do campo
3. **Seleção**: Ao clicar em um item:
   - Item é selecionado
   - Campo mostra o nome escolhido
   - Toast de confirmação aparece
   - Lista fecha automaticamente
4. **Limpar**: Botão X aparece quando há seleção
5. **Fechar**: Clicar fora ou pressionar Escape fecha a lista

## Customização

### Personalizar Exibição

```typescript
<SmartSearch
  getDisplayName={(item) => `${item.nome} (${item.codigo})`}
  getSubtitle={(item) => item.email || item.curso?.nome}
  searchFn={searchAlunos}
/>
```

### Ajustar Debounce e Limites

```typescript
<SmartSearch
  minSearchLength={3} // Buscar apenas com 3+ caracteres
  maxResults={5}      // Mostrar apenas 5 resultados
  debounceMs={500}   // Debounce de 500ms
  searchFn={searchAlunos}
/>
```

## Migração de Código Antigo

### Antes (Busca Manual)

```typescript
const [searchTerm, setSearchTerm] = useState('');
const filteredAlunos = alunos?.filter(a => 
  a.nome.toLowerCase().includes(searchTerm.toLowerCase())
);

<Input
  value={searchTerm}
  onChange={(e) => setSearchTerm(e.target.value)}
/>
<div>
  {filteredAlunos.map(aluno => (
    <div onClick={() => selectAluno(aluno.id)}>
      {aluno.nome}
    </div>
  ))}
</div>
```

### Depois (SmartSearch)

```typescript
const { searchAlunos } = useAlunoSearch();

<SmartSearch
  onSelect={(item) => selectAluno(item?.id)}
  searchFn={searchAlunos}
/>
```

## Telas Onde Aplicar

- ✅ Matrículas (Aluno)
- ✅ Presenças (Aluno)
- ✅ Avaliações (Aluno)
- ✅ Lançamento de Aulas (Professor)
- ✅ Biblioteca (Pessoa para empréstimo)
- ✅ RH (Funcionário)
- ✅ Financeiro (Aluno)
- ✅ Documentos (Aluno)
- ✅ Qualquer tela com Select grande

## Boas Práticas

1. **Sempre use hooks helpers** quando disponíveis
2. **Não carregue todos os registros** - deixe o SmartSearch buscar sob demanda
3. **Use placeholders descritivos** que indiquem o que buscar
4. **Mantenha o estado sincronizado** entre `selectedId` e `value`
5. **Trate erros** - o componente já trata, mas você pode adicionar validações extras

## Troubleshooting

### Resultados não aparecem
- Verifique se `searchFn` retorna `SmartSearchItem[]`
- Confirme que `minSearchLength` não está muito alto
- Verifique se há filtro de `instituicaoId` no backend

### Seleção não funciona
- Certifique-se de que `onSelect` atualiza o estado
- Verifique se `selectedId` está sendo passado corretamente

### Performance lenta
- Ajuste `debounceMs` para um valor maior
- Reduza `maxResults`
- Verifique se o backend está indexado corretamente

## Exemplo Completo

```typescript
import { useState } from 'react';
import { SmartSearch } from '@/components/common/SmartSearch';
import { useAlunoSearch } from '@/hooks/useSmartSearch';
import { Label } from '@/components/ui/label';

export function MinhaTela() {
  const { searchAlunos } = useAlunoSearch();
  const [alunoId, setAlunoId] = useState<string | null>(null);
  const [alunoNome, setAlunoNome] = useState<string>('');

  const handleSelect = (item: SmartSearchItem | null) => {
    if (item) {
      setAlunoId(item.id);
      setAlunoNome(item.nomeCompleto || item.nome_completo || '');
    } else {
      setAlunoId(null);
      setAlunoNome('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Aluno *</Label>
        <SmartSearch
          placeholder="Digite o nome do aluno ou número de BI..."
          value={alunoNome}
          selectedId={alunoId || undefined}
          onSelect={handleSelect}
          searchFn={searchAlunos}
          required
        />
      </div>

      {alunoId && (
        <p className="text-sm text-muted-foreground">
          Aluno selecionado: {alunoNome}
        </p>
      )}
    </div>
  );
}
```

## Conclusão

O `SmartSearch` padroniza a experiência de busca em todo o sistema, tornando a interface mais rápida, moderna e profissional. Use-o sempre que precisar selecionar entidades do sistema.

