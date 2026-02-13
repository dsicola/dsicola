import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModuloItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
  description?: string;
  badge?: string;
}

interface ModuloInstitucionalProps {
  title: string;
  description?: string;
  icon: React.ReactNode;
  items: ModuloItem[];
  color?: string;
  className?: string;
}

export function ModuloInstitucional({
  title,
  description,
  icon,
  items,
  color = 'bg-primary',
  className,
}: ModuloInstitucionalProps) {
  const navigate = useNavigate();

  if (items.length === 0) {
    return null;
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg', color)}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg font-semibold truncate">{title}</CardTitle>
            {description && (
              <CardDescription className="text-sm mt-1">{description}</CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((item, index) => (
            <Button
              key={`${item.href}-${item.label}-${index}`}
              variant="outline"
              className="h-auto p-4 flex flex-col items-start justify-start gap-2 hover:bg-accent transition-colors"
              onClick={() => navigate(item.href)}
            >
              <div className="flex items-center gap-2 w-full">
                {item.icon && <div className="text-muted-foreground">{item.icon}</div>}
                <span className="font-medium text-sm flex-1 text-left">{item.label}</span>
                {item.badge && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {item.badge}
                  </span>
                )}
              </div>
              {item.description && (
                <p className="text-xs text-muted-foreground text-left w-full">
                  {item.description}
                </p>
              )}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

