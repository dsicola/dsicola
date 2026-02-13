import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Usar console.warn em vez de console.error para evitar que seja tratado como erro de renderização
    // E usar try-catch para garantir que não cause erros
    try {
      const pathname = location?.pathname || 'unknown';
      if (process.env.NODE_ENV === 'development') {
        console.warn("404 Error: User attempted to access non-existent route:", pathname);
      }
    } catch (error) {
      // Silenciar qualquer erro relacionado ao location
    }
  }, [location]);

  const handleGoHome = () => {
    try {
      navigate('/');
    } catch (error) {
      window.location.href = '/';
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-6xl font-bold text-foreground">404</h1>
        <h2 className="text-2xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="text-lg text-muted-foreground">
          A página que você está procurando não existe ou foi movida.
        </p>
        <div className="pt-4">
          <Button onClick={handleGoHome} size="lg">
            Voltar para o início
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
