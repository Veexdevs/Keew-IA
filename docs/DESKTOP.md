# Keew IA — EXE · DMG · AppImage

Shell **Electron 32** endurecido (`contextIsolation`, `sandbox`, sem `nodeIntegration`).

```bash
npm install
npm --prefix apps/desktop install

npm run desktop:dev      # abre a janela apontando para KEEW_APP_URL
npm run desktop:win      # Windows: NSIS + portable
npm run desktop:mac      # macOS: dmg + zip (arm64 e x64)
npm run desktop:linux    # Linux: AppImage + deb
```

Artefatos em `apps/desktop/release/`.

## Windows (.exe)

Dois alvos: instalador **NSIS** (atalhos, escolha de diretório) e **portable**.
Rode em Windows ou use CI (`.github/workflows/release.yml` já incluso).

```bash
cd apps/desktop
npx electron-builder --win nsis portable
```

Assinatura (recomendada para evitar SmartScreen):

```env
CSC_LINK=./cert.pfx
CSC_KEY_PASSWORD=...
```

## macOS (.dmg)

Exige macOS para assinar/notarizar:

```bash
export APPLE_ID="seu@email.com"
export APPLE_APP_SPECIFIC_PASSWORD="senha-de-app"
export APPLE_TEAM_ID="TEAMID"
npx electron-builder --mac dmg --universal
```

Sem notarização, o usuário precisa liberar em *Preferências → Privacidade e Segurança*.

## Linux (AppImage / deb)

```bash
npx electron-builder --linux AppImage deb
```

## Customizações úteis

| O quê | Onde |
| --- | --- |
| URL carregada | `KEEW_APP_URL` (env) ou `apps/desktop/main.js` |
| Nome/ícone | `apps/desktop/package.json` → `build` |
| Menu | `main.js` → `template` |
| Fallback offline | `apps/desktop/build/offline.html` |
| Ícones | `apps/desktop/build/icon.{ico,png}` (gerados por `npm run brand`) |

## Auto-update (opcional)

`electron-updater` já está nas dependências. Publique os artefatos em GitHub Releases,
defina `build.publish` (provedor `github`) e adicione no `main.js`:

```js
require("electron-updater").autoUpdater.checkForUpdatesAndNotify();
```
