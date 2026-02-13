/**
 * Utilitários para responsividade
 */

/**
 * Classes Tailwind comuns para responsividade
 */
export const responsiveClasses = {
  // Padding responsivo
  cardPadding: 'p-4 sm:p-6',
  sectionPadding: 'p-3 sm:p-4 md:p-6',
  
  // Grid responsivo
  grid1: 'grid-cols-1',
  grid2: 'grid-cols-1 md:grid-cols-2',
  grid3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  grid4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  
  // Flex responsivo
  flexCol: 'flex-col sm:flex-row',
  flexColReverse: 'flex-col-reverse sm:flex-row',
  
  // Width responsivo
  fullWidth: 'w-full sm:w-auto',
  fullWidthMobile: 'w-full md:w-auto',
  
  // Text responsivo
  textSmall: 'text-sm sm:text-base',
  textBase: 'text-base sm:text-lg',
  textLarge: 'text-lg sm:text-xl md:text-2xl',
  
  // Gap responsivo
  gapSmall: 'gap-2 sm:gap-3 md:gap-4',
  gapMedium: 'gap-3 sm:gap-4 md:gap-6',
  
  // Button sizes
  buttonFull: 'w-full sm:w-auto',
  buttonIcon: 'h-8 w-8 md:h-9 md:w-9',
  
  // Dialog/Modal
  dialogWidth: 'w-[95vw] sm:w-full',
  dialogMaxHeight: 'max-h-[90vh]',
};

/**
 * Helper para aplicar classes responsivas
 */
export function cnResponsive(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

