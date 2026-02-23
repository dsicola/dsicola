import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe } from 'lucide-react';

const LANGUAGES = [
  { code: 'pt-BR', label: 'Português (BR)' },
  { code: 'pt-AO', label: 'Português (AO)' },
  { code: 'en', label: 'English' },
] as const;

export function LanguageSelector() {
  const { i18n } = useTranslation();

  const handleChange = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('i18nextLng', lng);
  };

  const currentLabel = LANGUAGES.find((l) => l.code === i18n.language)?.label ?? 'pt-BR';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Globe className="h-4 w-4" aria-hidden />
          <span className="sr-only">{currentLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LANGUAGES.map(({ code, label }) => (
          <DropdownMenuItem
            key={code}
            onClick={() => handleChange(code)}
            className={i18n.language === code ? 'bg-accent' : ''}
          >
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
