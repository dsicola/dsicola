import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { getApiErrorMessage } from '@/utils/apiErrors';

/**
 * Estado de erro padrão para useQuery: mensagem amigável + retry opcional.
 * Use com isError/error/refetch do React Query.
 */
export function QueryErrorBanner({
  error,
  onRetry,
  fallback = 'Não foi possível carregar os dados.',
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  fallback?: string;
  className?: string;
}) {
  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="space-y-3">
        <p>{getApiErrorMessage(error, fallback)}</p>
        {onRetry ? (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Tentar novamente
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
