import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Search, Loader2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { messages, formatMessage } from '@/lib/messages';

export interface SmartSearchItem {
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

export interface SmartSearchProps {
  // Configuração básica
  placeholder?: string;
  value?: string; // Valor inicial (nome do item selecionado)
  selectedId?: string; // ID do item selecionado
  onSelect: (item: SmartSearchItem | null) => void;
  onClear?: () => void;
  
  // Função de busca
  searchFn: (searchTerm: string) => Promise<SmartSearchItem[]>;
  
  // Configurações
  minSearchLength?: number; // Mínimo de caracteres para buscar (padrão: 2)
  maxResults?: number; // Máximo de resultados (padrão: 10)
  debounceMs?: number; // Tempo de debounce (padrão: 300ms)
  
  // Customização
  getDisplayName?: (item: SmartSearchItem) => string;
  getSubtitle?: (item: SmartSearchItem) => string;
  emptyMessage?: string;
  loadingMessage?: string;
  
  // Estados
  disabled?: boolean;
  className?: string;
  
  // Validação
  required?: boolean;
  error?: string;
}

export function SmartSearch({
  placeholder = messages.search.placeholder,
  value: initialValue,
  selectedId,
  onSelect,
  onClear,
  searchFn,
  minSearchLength = 2,
  maxResults = 10,
  debounceMs = 300,
  getDisplayName = (item) => item.nomeCompleto || item.nome_completo || item.nome || '',
  getSubtitle = (item) => {
    const parts: string[] = [];
    if (item.email) parts.push(item.email);
    if (item.numeroIdentificacao || item.numero_identificacao) {
      parts.push(item.numeroIdentificacao || item.numero_identificacao);
    }
    if (item.complemento) parts.push(item.complemento);
    return parts.join(' • ');
  },
  emptyMessage = messages.empty.noResults,
  loadingMessage = messages.search.searching,
  disabled = false,
  className,
  required = false,
  error,
}: SmartSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SmartSearchItem | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce do termo de busca
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [searchTerm, debounceMs]);

  // Buscar resultados
  const { data: results = [], isLoading } = useQuery({
    queryKey: ['smart-search', debouncedSearchTerm],
    queryFn: () => searchFn(debouncedSearchTerm),
    enabled: debouncedSearchTerm.length >= minSearchLength && isOpen,
    staleTime: 30000, // Cache por 30s
  });

  // Inicializar com valor selecionado
  useEffect(() => {
    if (selectedId && initialValue && !selectedItem) {
      setSelectedItem({
        id: selectedId,
        nome: initialValue,
        nomeCompleto: initialValue,
      });
      setSearchTerm(initialValue);
    }
  }, [selectedId, initialValue]);

  // Fechar ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fechar ao pressionar Escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    // Se limpar o campo, limpar seleção
    if (!value) {
      setSelectedItem(null);
      onSelect(null);
      if (onClear) onClear();
    } else {
      setIsOpen(true);
    }
  };

  const handleSelect = (item: SmartSearchItem) => {
    setSelectedItem(item);
    setSearchTerm(getDisplayName(item));
    setIsOpen(false);
    onSelect(item);
    
    // Mensagem de confirmação
    toast.success(formatMessage(messages.search.selectedItem, { nome: getDisplayName(item) }), {
      duration: 2000,
    });
  };

  const handleClear = () => {
    setSearchTerm('');
    setSelectedItem(null);
    setIsOpen(false);
    onSelect(null);
    if (onClear) onClear();
    inputRef.current?.focus();
  };

  const handleFocus = () => {
    if (searchTerm.length >= minSearchLength) {
      setIsOpen(true);
    }
  };

  const displayResults = results.slice(0, maxResults);
  const hasResults = displayResults.length > 0;
  const showResults = isOpen && debouncedSearchTerm.length >= minSearchLength;

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleFocus}
          disabled={disabled}
          required={required}
          className={cn(
            "pl-10 pr-10",
            error && "border-red-500 focus-visible:ring-red-500",
            selectedItem && "pr-10"
          )}
        />
        {selectedItem && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Limpar seleção"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {selectedItem && !searchTerm && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Check className="h-4 w-4 text-green-600" />
          </div>
        )}
      </div>

      {/* Lista de resultados */}
      {showResults && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-[300px] overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline-block mr-2" />
              {loadingMessage}
            </div>
          ) : hasResults ? (
            <div className="py-1">
              {displayResults.map((item) => {
                const displayName = getDisplayName(item);
                const subtitle = getSubtitle(item);
                const isSelected = selectedItem?.id === item.id;

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    className={cn(
                      "px-4 py-3 cursor-pointer transition-colors border-b last:border-b-0",
                      isSelected
                        ? "bg-primary/10 hover:bg-primary/15"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{displayName}</p>
                        {subtitle && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {subtitle}
                          </p>
                        )}
                      </div>
                      {isSelected && (
                        <Check className="h-4 w-4 text-primary ml-2 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          )}
        </div>
      )}

      {/* Mensagem de erro */}
      {error && (
        <p className="text-sm text-red-500 mt-1">{error}</p>
      )}

      {/* Mensagem de confirmação quando selecionado */}
      {selectedItem && !isOpen && (
        <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
          <Check className="h-3 w-3" />
          {getDisplayName(selectedItem)} selecionado
        </p>
      )}
    </div>
  );
}

