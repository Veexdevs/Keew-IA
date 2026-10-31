# Keew IA — APK Android

O shell Android usa **Capacitor 6** e carrega a versão web publicada. Pré-requisitos:
Node 20+, JDK 17, Android Studio + SDK 34.

```bash
npm install
npm --prefix apps/mobile install

export KEEW_APP_URL="https://keew-ia.vercel.app"   # ou seu domínio
npm run mobile:sync

cd apps/mobile
npx cap add android          # primeira vez: gera apps/mobile/android
npx cap open android         # abre no Android Studio
```

## Ícone e splash

Já existem em `apps/mobile/resources/` (`icon.png` 1024², `splash.png` 2732²), gerados
da arte oficial por `npm run brand`. Para regenerar todas as densidades:

```bash
cd apps/mobile
npx capacitor-assets generate --android
```

## Build de depuração

```bash
cd apps/mobile/android
./gradlew assembleDebug
# → app/build/outputs/apk/debug/app-debug.apk
```

## Build assinado para a Play Store

```bash
keytool -genkey -v -keystore keew.keystore -alias keew \
  -keyalg RSA -keysize 2048 -validity 10000

cd apps/mobile/android
./gradlew bundleRelease \
  -Pandroid.injected.signing.store.file=$PWD/keew.keystore \
  -Pandroid.injected.signing.store.password=SENHA \
  -Pandroid.injected.signing.key.alias=keew \
  -Pandroid.injected.signing.key.password=SENHA
# → app/build/outputs/bundle/release/app-release.aab
```

### Via CLI (sem Android Studio)

```bash
cd apps/mobile
npx cap build android --keystorepath keew.keystore --keystorealias keew
```

## Checklist rápido

- [ ] `KEEW_APP_URL` aponta para produção (HTTPS obrigatório fora de dev)
- [ ] `appId` = `ai.keew.app` (ou troque em `capacitor.config.ts` antes do `cap add`)
- [ ] splash com fundo `#004CFD` e status bar escura
- [ ] testar teclado (plugin `@capacitor/keyboard` já configurado)
- [ ] versionar `versionCode`/`versionName` em `android/app/build.gradle`
