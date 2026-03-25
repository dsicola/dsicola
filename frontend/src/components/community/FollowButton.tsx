import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { communityApi } from '@/services/communityApi';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface FollowButtonProps {
  instituicaoId: string;
  initialFollowing: boolean;
}

export const FollowButton: React.FC<FollowButtonProps> = ({ instituicaoId, initialFollowing }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const following = optimistic ?? initialFollowing;

  const mutation = useMutation({
    mutationFn: async () => {
      if (following) {
        return communityApi.unfollow(instituicaoId);
      }
      return communityApi.follow(instituicaoId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-institution', instituicaoId] });
      setOptimistic(null);
    },
    onError: () => {
      setOptimistic(null);
      toast.error('Não foi possível atualizar. Tente de novo.');
    },
  });

  const handleClick = () => {
    if (!user) {
      navigate(`/auth?from=${encodeURIComponent(`/escolas/${instituicaoId}`)}`);
      return;
    }
    setOptimistic(!following);
    mutation.mutate();
  };

  return (
    <Button
      type="button"
      variant={following ? 'secondary' : 'default'}
      size="sm"
      className="gap-2"
      disabled={mutation.isPending}
      onClick={handleClick}
    >
      <Heart className={`h-4 w-4 ${following ? 'fill-current' : ''}`} aria-hidden />
      {following ? 'A seguir' : 'Seguir instituição'}
    </Button>
  );
};
