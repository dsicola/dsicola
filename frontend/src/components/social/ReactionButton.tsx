import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ComponentType } from 'react';
import { Heart, GraduationCap, ThumbsUp } from 'lucide-react';
import type { SocialReactionType } from '@/services/socialApi';
import { cn } from '@/lib/utils';

const REACTIONS: { type: SocialReactionType; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { type: 'LIKE', label: 'Gosto', icon: ThumbsUp },
  { type: 'LOVE', label: 'Adoro', icon: Heart },
  { type: 'EDUCATIONAL', label: 'Útil / educativo', icon: GraduationCap },
];

interface ReactionButtonProps {
  postId: string;
  myReaction: SocialReactionType | null;
  disabled?: boolean;
  onSelect: (type: SocialReactionType) => void;
  onClear: () => void;
  compact?: boolean;
}

export function ReactionButton({
  myReaction,
  disabled,
  onSelect,
  onClear,
  compact,
}: ReactionButtonProps) {
  const active = REACTIONS.find((r) => r.type === myReaction);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={myReaction ? 'secondary' : 'ghost'}
          size={compact ? 'sm' : 'default'}
          className={cn('gap-1', myReaction && 'text-primary')}
          disabled={disabled}
        >
          {active ? (
            <>
              <active.icon className="h-4 w-4" />
              {!compact && <span className="text-xs">{active.label}</span>}
            </>
          ) : (
            <>
              <ThumbsUp className="h-4 w-4" />
              {!compact && <span className="text-xs">Reagir</span>}
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {REACTIONS.map(({ type, label, icon: Icon }) => (
          <DropdownMenuItem key={type} onClick={() => onSelect(type)} className="gap-2">
            <Icon className="h-4 w-4" />
            {label}
          </DropdownMenuItem>
        ))}
        {myReaction ? (
          <DropdownMenuItem onClick={onClear} className="text-muted-foreground">
            Remover reação
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
