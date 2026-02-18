import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formata valor numérico com segurança - evita "toFixed is not a function" quando API retorna string/null */
export function safeToFixed(value: unknown, digits = 1): string {
  const n = Number(value);
  return Number.isNaN(n) ? "0" : n.toFixed(digits);
}

/** Converte para string e aplica toLowerCase com segurança - evita "toLowerCase is not a function" */
export function safeToLowerCase(value: unknown): string {
  if (value == null) return '';
  const s = typeof value === 'string' ? value : String(value);
  return s.toLowerCase();
}
