/**
 * Minimal, dependency-free bridge. Only non-sensitive metadata crosses over.
 */
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("keewDesktop", {
  platform: process.platform,
  arch: process.arch,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  isDesktop: true,
});
