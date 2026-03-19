import { Capacitor } from '@capacitor/core';

/**
 * Inicialização nativa (iOS/Android): barra de estado alinhada à marca e splash controlado.
 * No browser não faz nada — zero impacto no web/PWA.
 */
export async function initCapacitorNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const [{ SplashScreen }, { StatusBar, Style }] = await Promise.all([
      import('@capacitor/splash-screen'),
      import('@capacitor/status-bar'),
    ]);

    try {
      await StatusBar.setOverlaysWebView({ overlay: false });
      await StatusBar.setStyle({ style: Style.Light });
      await StatusBar.setBackgroundColor({ color: '#1e40af' });
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn('[Capacitor] StatusBar:', e);
      }
    }

    const hideSplash = () => {
      void SplashScreen.hide().catch(() => {});
    };

    requestAnimationFrame(() => {
      setTimeout(hideSplash, 280);
    });
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[Capacitor] initCapacitorNative:', e);
    }
  }
}
