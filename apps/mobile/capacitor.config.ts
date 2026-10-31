import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The native shells wrap the published web app (single source of truth).
 * Point KEEW_APP_URL at any deployment — local dev, preview or production.
 */
const serverUrl = process.env.KEEW_APP_URL || "https://keew-ia.vercel.app";

const config: CapacitorConfig = {
  appId: "ai.keew.app",
  appName: "Keew IA",
  webDir: "www",
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://"),
  },
  backgroundColor: "#000000",
  android: {
    allowMixedContent: false,
    backgroundColor: "#000000",
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    contentInset: "always",
    backgroundColor: "#000000",
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      backgroundColor: "#004CFD",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#000000",
      overlaysWebView: false,
    },
    Keyboard: {
      resize: "native",
      style: "DARK",
      resizeOnFullScreen: true,
    },
  },
};

export default config;
