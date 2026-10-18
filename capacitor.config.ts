import type { CapacitorConfig } from '@capacitor/cli';

// Native shells for Google Play (Android) and the Apple App Store (iOS/iPadOS).
// Build the web app first (npm run build) — Capacitor packages the dist/ folder.
const config: CapacitorConfig = {
  appId: 'com.spadehaven.app',      // change to your own reverse-domain id before publishing
  appName: 'Spade Haven',
  webDir: 'dist',
  backgroundColor: '#1a0410',
  android: { allowMixedContent: false },
  ios: { contentInset: 'never' },
};

export default config;
