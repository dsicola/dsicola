import type { CapacitorConfig } from '@capacitor/cli';

/**
 * DSICOLA — apps iOS/Android (Capacitor).
 * - Build web para nativo: `npm run build:mobile` (sem PWA no bundle — evita conflitos na WebView).
 * - Sincronizar: `npm run cap:sync`
 * - Produção: definir VITE_API_URL (ver mobile.env.example e docs/MOBILE_APP_CAPACITOR.md).
 */
const config: CapacitorConfig = {
  appId: 'com.dsicola.app',
  appName: 'DSICOLA',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'automatic',
    scrollEnabled: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      launchFadeOutDuration: 220,
      backgroundColor: '#ffffff',
      androidScaleType: 'FIT_CENTER',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#1e40af',
    },
  },
};

export default config;
