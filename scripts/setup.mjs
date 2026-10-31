#!/usr/bin/env node
/**
 * Keew IA — setup interativo (1 minuto).
 * Cria o .env.local com o motor de raciocínio da Keew e imprime o próximo passo.
 *
 * Não existe menu de fornecedores: a Keew tem um motor só. Você só informa
 * onde ele roda e qual é a chave dele.
 */
import { createInterface } from "node:readline/promises";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { stdin, stdout } from "node:process";

const rl = createInterface({ input: stdin, output: stdout });
const ENV = ".env.local";

console.log(`
  ╭──────────────────────────────────────────────╮
  │  KEEW IA · setup                             │
  │  inteligência artificial própria             │
  ╰──────────────────────────────────────────────╯
`);

/* ── motor de raciocínio ──────────────────────────────────────────────────── */

console.log("  O motor padrão da Keew já está configurado.\n");
console.log("  Pressione Enter para usar o padrão, ou informe outra base URL");
console.log("  caso você rode o motor na sua própria infraestrutura (GPU própria).\n");

const baseUrl =
  (await rl.question("  Base URL do motor [https://api.deepseek.com/v1]: ")).trim() ||
  "https://api.deepseek.com/v1";

const model =
  (await rl.question("  Modelo do motor [deepseek-reasoner]: ")).trim() || "deepseek-reasoner";

const isLocal = /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(baseUrl);
let apiKey = "";
if (!isLocal) {
  console.log("\n  Informe a chave do motor. Ela fica só no servidor — nunca vai ao navegador.");
  apiKey = (await rl.question("  Chave do motor: ")).trim();
}

/* ── identidade e agendador ───────────────────────────────────────────────── */

const accessKey = randomBytes(24).toString("hex");
const cronSecret = randomBytes(24).toString("hex");
const appUrl =
  (await rl.question("\n  URL pública do app [https://keew-ia.vercel.app]: ")).trim() ||
  "https://keew-ia.vercel.app";

/* ── escreve o .env.local ─────────────────────────────────────────────────── */

const existing = existsSync(ENV) ? readFileSync(ENV, "utf8") : "";
if (existing) {
  const backup = `${ENV}.bak`;
  writeFileSync(backup, existing, "utf8");
  console.log(`\n  · ${ENV} anterior salvo em ${backup}`);
}

const env = `# Keew IA — gerado por scripts/setup.mjs em ${new Date().toISOString()}

# Motor de raciocínio (servidor). A Keew expõe um único modelo público: keew-1.
KEEW_MODEL_BASE_URL=${baseUrl}
KEEW_MODEL_NAME=${model}
KEEW_MODEL_API_KEY=${apiKey}

# Chave da API própria (/api/v1) e do workspace.
KEEW_ACCESS_KEY=${accessKey}

# Agendador 24/7.
KEEW_CRON_SECRET=${cronSecret}
NEXT_PUBLIC_APP_URL=${appUrl}

# Memória na nuvem (opcional).
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
`;

writeFileSync(ENV, env, "utf8");
console.log(`\n  ✓ ${ENV} criado`);
console.log(`  ✓ chave da API da Keew: ${accessKey.slice(0, 8)}…  (completa no arquivo)`);

/* ── confere o motor ──────────────────────────────────────────────────────── */

if (apiKey || isLocal) {
  process.stdout.write("  · testando o motor da Keew… ");
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "ok" }],
        max_tokens: 5,
        stream: false,
      }),
    });
    console.log(res.ok ? "motor respondendo ✓" : `falhou (HTTP ${res.status}) — confira a chave`);
  } catch (err) {
    console.log(`sem resposta (${err.message}) — rode de novo quando estiver online`);
  }
} else {
  console.log("  · sem chave: a Keew sobe com o núcleo determinístico (cálculos, datas, resumos)");
}

console.log(`
  Pronto. Próximos passos:

    npm run dev            → abra http://localhost:3000
    npm test               → testes do núcleo local
    vercel --prod          → publique com agenda 24/7 (vercel.json)

  A API da Keew fica em /api/v1  ·  modelo público: keew-1
  Use a chave KEEW_ACCESS_KEY no header  x-keew-key  para chamar de fora.
`);

rl.close();
