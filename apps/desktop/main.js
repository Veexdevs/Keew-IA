/**
 * Keew IA — desktop shell.
 * Loads the published web app in a hardened BrowserWindow. Keeps a local
 * fallback page so the app still opens when offline.
 */
const { app, BrowserWindow, Menu, shell, dialog, nativeTheme } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

const APP_URL = process.env.KEEW_APP_URL || "https://keew-ia.vercel.app";
const LOCAL_PAGE = path.join(__dirname, "build", "offline.html");

let mainWindow = null;

function createWindow() {
  nativeTheme.themeSource = "dark";

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 420,
    minHeight: 560,
    backgroundColor: "#000000",
    title: "Keew IA",
    icon: path.join(__dirname, "build", "icon.png"),
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: { x: 14, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  mainWindow.loadURL(APP_URL).catch(() => {
    if (fs.existsSync(LOCAL_PAGE)) mainWindow.loadFile(LOCAL_PAGE);
  });

  // external links open in the OS browser, never inside the shell
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const target = new URL(url);
    const allowed = new URL(APP_URL);
    if (target.origin !== allowed.origin && !url.startsWith("file:")) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // surface network failure gracefully
  mainWindow.webContents.on("did-fail-load", () => {
    if (fs.existsSync(LOCAL_PAGE)) mainWindow.loadFile(LOCAL_PAGE);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

const template = [
  ...(process.platform === "darwin"
    ? [{ role: "appMenu" }]
    : []),
  {
    label: "Arquivo",
    submenu: [
      {
        label: "Nova conversa",
        accelerator: "CmdOrCtrl+N",
        click: () => mainWindow?.webContents.executeJavaScript('window.dispatchEvent(new KeyboardEvent("keydown",{key:"j",metaKey:true}))'),
      },
      { type: "separator" },
      process.platform === "darwin" ? { role: "close" } : { role: "quit", label: "Sair" },
    ],
  },
  { role: "editMenu", label: "Editar" },
  { role: "viewMenu", label: "Exibir" },
  {
    label: "Ajuda",
    submenu: [
      { label: "Site da Keew", click: () => shell.openExternal(APP_URL) },
      { label: "Abrir DevTools", accelerator: "CmdOrCtrl+Shift+I", click: () => mainWindow?.webContents.toggleDevTools() },
      {
        label: "Sobre",
        click: () =>
          dialog.showMessageBox(mainWindow, {
            type: "info",
            title: "Keew IA",
            message: `Keew IA ${app.getVersion()}`,
            detail: "Inteligência artificial própria.\nWeb · Android · iOS · Windows · macOS · Linux.\n\n© 2026 Veexdevs",
            buttons: ["Fechar"],
          }),
      },
    ],
  },
];

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// harden: block permission requests the assistant does not need
app.on("web-contents-created", (_event, contents) => {
  contents.session.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(["media", "clipboard-read", "clipboard-sanitized-write"].includes(permission));
  });
});
