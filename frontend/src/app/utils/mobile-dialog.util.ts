import { MatDialogConfig } from '@angular/material/dialog';

/**
 * Returns a MatDialogConfig that makes the dialog fullscreen on mobile devices
 * (screen width < 640px, i.e. Tailwind's `sm` breakpoint).
 * On larger screens, applies the provided desktopWidth.
 */
export function mobileAwareDialogConfig<T>(
  desktopWidth: string,
  data?: T,
  extraConfig: Partial<MatDialogConfig<T>> = {}
): MatDialogConfig<T> {
  const isMobile = window.innerWidth < 640;
  return {
    width: isMobile ? '100vw' : desktopWidth,
    maxWidth: isMobile ? '100vw' : '90vw',
    height: isMobile ? '100dvh' : 'auto',
    panelClass: isMobile ? ['fullscreen-dialog'] : [],
    data,
    ...extraConfig,
  };
}
