import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Keew IA",
    short_name: "Keew",
    description:
      "Inteligência artificial própria: raciocínio local, modelos de ponta, agentes e automação 24/7.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#000000",
    theme_color: "#000000",
    lang: "pt-BR",
    dir: "ltr",
    categories: ["productivity", "utilities", "education"],
    icons: [
      { src: "/icons/favicon-32.png", sizes: "32x32", type: "image/png", purpose: "any" },
      { src: "/icons/android-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/app-icon-1024.png", sizes: "1024x1024", type: "image/png", purpose: "any" },
    ],
    shortcuts: [
      { name: "Nova conversa", url: "/", description: "Abrir um novo chat com a Keew" },
    ],
  };
}
