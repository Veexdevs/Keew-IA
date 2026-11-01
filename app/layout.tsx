import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { ThemeProvider } from "@/components/layout/theme-provider";
import { Toast } from "@/components/ui/toast";
import "highlight.js/styles/github-dark-dimmed.css";
import "katex/dist/katex.min.css";
import "./globals.css";

const SITE = process.env.NEXT_PUBLIC_APP_URL || "https://keew-ia.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Keew IA — inteligência artificial própria",
    template: "%s · Keew IA",
  },
  description:
    "Keew IA: inteligência artificial própria com raciocínio local, agentes, base de conhecimento e automação 24/7. Web, APK, IPA e EXE.",
  applicationName: "Keew IA",
  keywords: ["Keew IA", "inteligência artificial", "IA própria", "assistente", "workspace", "agentes"],
  authors: [{ name: "Veexdevs" }],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/app-icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    title: "Keew IA — inteligência artificial própria",
    description: "Raciocínio local + modelos de ponta, agentes, conhecimento e automação 24/7.",
    url: SITE,
    siteName: "Keew IA",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Keew IA" }],
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Keew IA",
    description: "Inteligência artificial própria — web, APK, IPA e EXE.",
    images: ["/og.png"],
  },
  appleWebApp: {
    capable: true,
    title: "Keew IA",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
    { media: "(prefers-color-scheme: light)", color: "#f7f9fc" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      data-theme="onyx"
      style={{ colorScheme: "dark" }}
    >
      <head>
        {/*
          Applies the persisted theme before first paint so a light-theme user
          never sees a dark flash. Mirrors components/layout/theme-provider.tsx.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{
var raw=localStorage.getItem('keew-ia-v1');if(!raw)return;
var s=JSON.parse(raw).state||{};var st=s.settings||{};
var root=document.documentElement;
var THEMES={onyx:'#2f6bff',midnight:'#3b82f6',obsidian:'#fafafa',aurora:'#8b5cf6',ember:'#f97316',matrix:'#22c55e',cyber:'#22d3ee',sakura:'#f472b6',graphite:'#a3e635',depth:'#06b6d4',arctic:'#004cfd',papyrus:'#b45309',linen:'#141413',solar:'#d97706'};
var theme=st.theme||'onyx';
root.dataset.theme=THEMES[theme]?theme:'onyx';
root.dataset.radius=st.radius||'soft';
root.dataset.density=st.density||'comfortable';
root.dataset.backdrop=st.backdrop||'glow';
var hex=st.accentOverride||THEMES[theme]||'#0b5cff';
var m=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
if(m){var r=parseInt(m[1],16),g=parseInt(m[2],16),b=parseInt(m[3],16);
root.style.setProperty('--accent',hex);
root.style.setProperty('--glow',r+' '+g+' '+b);
root.style.setProperty('--accent-soft','rgb('+r+' '+g+' '+b+' / 0.14)');
root.style.setProperty('--accent-line','rgb('+r+' '+g+' '+b+' / 0.38)');
var L=(0.2126*Math.pow(r/255,2.2)+0.7152*Math.pow(g/255,2.2)+0.0722*Math.pow(b/255,2.2));
root.style.setProperty('--accent-fg',L>0.45?'#04120a':'#ffffff');}
}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-bg text-fg antialiased">
        <ThemeProvider>
          {children}
          <Toast />
        </ThemeProvider>
      </body>
    </html>
  );
}
