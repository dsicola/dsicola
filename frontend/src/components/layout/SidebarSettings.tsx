import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Settings, 
  ArrowLeft, 
  ArrowRight, 
  ArrowUp, 
  ArrowDown,
  Pin,
  Move
} from 'lucide-react';
import { useSidebarPreferences, SidebarPosition, SidebarMode } from '@/hooks/useSidebarPreferences';
import { cn } from '@/lib/utils';

interface SidebarSettingsProps {
  className?: string;
}

/**
 * Componente de configurações da sidebar
 * Permite alterar posição (esquerda, direita, topo, fundo) e modo (fixo/flutuante)
 * Suporta multi-tenant: preferências salvas por instituição
 */
export const SidebarSettings: React.FC<SidebarSettingsProps> = ({ className }) => {
  const { preferences, setPosition, setMode } = useSidebarPreferences();

  const positionIcons = {
    left: ArrowLeft,
    right: ArrowRight,
    top: ArrowUp,
    bottom: ArrowDown,
  };

  const positionLabels = {
    left: 'Esquerda',
    right: 'Direita',
    top: 'Topo',
    bottom: 'Fundo',
  };

  const modeLabels = {
    fixed: 'Fixo',
    floating: 'Flutuante',
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-8 w-8', className)}
          title="Configurações da Sidebar"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Posição da Sidebar</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Opções de Posição */}
        {(['left', 'right', 'top', 'bottom'] as SidebarPosition[]).map((position) => {
          const Icon = positionIcons[position];
          const isActive = preferences.position === position;
          
          return (
            <DropdownMenuItem
              key={position}
              onClick={() => {
                console.log('[SidebarSettings] Mudando posição para:', position);
                setPosition(position);
              }}
              className={cn(
                'flex items-center gap-2 cursor-pointer',
                isActive && 'bg-accent font-semibold'
              )}
            >
              <Icon className={cn('h-4 w-4', isActive ? 'text-primary' : 'text-muted-foreground')} />
              <span>{positionLabels[position]}</span>
              {isActive && <span className="ml-auto text-xs text-primary">✓</span>}
            </DropdownMenuItem>
          );
        })}
        
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Modo</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Opções de Modo */}
        {(['fixed', 'floating'] as SidebarMode[]).map((mode) => {
          const Icon = mode === 'fixed' ? Pin : Move;
          const isActive = preferences.mode === mode;
          
          return (
            <DropdownMenuItem
              key={mode}
              onClick={() => {
                console.log('[SidebarSettings] Mudando modo para:', mode);
                setMode(mode);
              }}
              className={cn(
                'flex items-center gap-2 cursor-pointer',
                isActive && 'bg-accent font-semibold'
              )}
            >
              <Icon className={cn('h-4 w-4', isActive ? 'text-primary' : 'text-muted-foreground')} />
              <span>{modeLabels[mode]}</span>
              {isActive && <span className="ml-auto text-xs text-primary">✓</span>}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
