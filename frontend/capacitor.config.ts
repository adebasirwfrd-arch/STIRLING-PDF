import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.stirling.pdf',
  appName: 'Stirling PDF',
  webDir: 'dist',
  server: {
    url: 'https://stirling-pdf-sage.vercel.app/?v=2',
    cleartext: true,
    allowNavigation: ["*"]
  },
  android: {
    overrideUserAgent: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36",
    allowVideoFullscreen: true,
    appendUserAgent: "Stirling-PDF-Mobile",
    useLegacyBridge: true
  }
};

export default config;
