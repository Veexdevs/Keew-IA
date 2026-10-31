# Keew IA — IPA iOS

Pré-requisitos: macOS + Xcode 15+, CocoaPods, conta Apple Developer (para distribuição).

```bash
npm install
npm --prefix apps/mobile install

export KEEW_APP_URL="https://keew-ia.vercel.app"
npm run mobile:sync

cd apps/mobile
npx cap add ios              # gera apps/mobile/ios
npx capacitor-assets generate --ios
npx cap open ios             # abre o workspace no Xcode
```

## Assinatura

1. Xcode → target **App** → *Signing & Capabilities* → Time/Team.
2. Bundle identifier: `ai.keew.app`.
3. *Deployment Info*: iOS 14+.

## Archive → IPA

Xcode → **Product → Archive** → *Distribute App* → **App Store Connect** (loja) ou
**Ad Hoc / Development** (instalação direta em aparelhos registrados).

Gerar IPA sem a loja:

```bash
cd apps/mobile/ios/App
xcodebuild -workspace App.xcworkspace -scheme App \
  -configuration Release -archivePath build/Keew.xcarchive archive
xcodebuild -exportArchive -archivePath build/Keew.xcarchive \
  -exportOptionsPlist ExportOptions.plist -exportPath build/
```

`ExportOptions.plist` mínimo (development):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>development</string>
  <key>teamID</key><string>SEU_TEAM_ID</string>
</dict></plist>
```

## Notas de segurança do WebView

- `limitsNavigationsToAppBoundDomains: false` → permite carregar seu domínio em preview.
- Para a App Store, defina `true` e liste o domínio em *WKAppBoundDomains* no `Info.plist`.
- A Keew não usa câmera nem localização; só microfone se você habilitar voz.
