import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.stirling.pdf',
  appName: 'Stirling PDF',
  webDir: 'dist',
  server: {
    url: 'https://stirling-pdf-sage.vercel.app/',
    cleartext: true,
    allowNavigation: ["*"]
  },
  android: {
    overrideUserAgent: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36"
  }
};

export default config;
