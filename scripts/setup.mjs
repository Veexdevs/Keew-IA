#!/usr/bin/env node
/**
 * Keew IA — setup interativo (1 minuto).
 * Cria .env.local, valida o gateway e imprime o próximo passo.
 */
import { createInterface } from "node:readline/promises";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { stdin, stdout } from "node:process";

const rl = createInterface({ input: stdin, output: stdout });
const ENV = ".env.local";

const PROVIDERS = {
  1: { id: "deepseek", name: "DeepSeek (recomendado — R1)", base: "https://api.deepseek.com/v1", model: "deepseek-reasoner", url: "https://platform.deepseek.com/api_keys" },
  2: { id: "openrouter", name: "OpenRouter (vários modelos)", base: "https://openrouter.ai/api/v1", model: "deepseek/deepseek-r1", url: "https://openrouter.ai/keys" },
  3: { id: "groq", name: "Groq (rápido e gratuito)", base: "https://api.groq.com/openai/v1", model: "deepseek-r1-distill-llama-70b", url: "https://console.groq.com/keys" },
  4: { id: "ollama", name: "Ollama local (sem chave)", base: "http://127.0.0.1:11434/v1", model: "deepseek-r1:8b", url: "https://ollama.com" },
  5: { id: "local", name: "Inferência própria (vLLM/TGI)", base: "http://127.0.0.1:8080/v1", model: "keew-local", url: "docs/OWN-MODEL.md" },
};

console.log(`
  ╭──────────────────────────────────────────────╮
  │  KEEW IA · setup                             │
  │  inteligência artificial própria             │
  ╰──────────────────────────────────────────────╯
`);

for (const [k, p] of Object.entries(PROVIDERS)) console.log(`  ${k}) ${p.name}`);

const choice = (await rl.question("\n  Provedor [1]: ")).trim() || "1";
const provider = PROVIDERS[choice] || PROVIDERS["1"];

let apiKey = "";
if (provider.id !== "ollama" && provider.id !== "local") {
  console.log(`\n  Obtenha a chave em: ${provider.url}`);
  apiKey = (await rl.question("  Cole a API key: ")).trim();
}

const cronSecret = randomBytes(24).toString("hex");
const appUrl = (await rl.question("\n  URL pública do app [https://keew-ia.vercel.app]: ")).trim()
  || "https://keew-ia.vercel.app";

const env = `# Keew IA — gerado por scripts/setup.mjs em ${new Date().toISOString()}
KEEW_MODEL_PROVIDER=${provider.id}
KEEW_MODEL_BASE_URL=${provider.base}
KEEW_MODEL_NAME=${provider.model}
KEEW_MODEL_API_KEY=${apiKey}
KEEW_CRON_SECRET=${cronSecret}
NEXT_PUBLIC_APP_URL=${appUrl}

# Supabase (opcional — memória na nuvem e sincronização multi-dispositivo)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Chave de acesso do workspace (deixe vazio para acesso livre)
KEEW_ACCESS_KEY=
`;

writeFileSync(ENV, env, "utf8");
console.log(`\n  ✓ ${ENV} criado`);

// quick gateway probe
if (apiKey) {
  process.stdout.write("  · testando o provedor… ");
  try {
    const res = await fetch(`${provider.base}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: provider.model,
        messages: [{ role: "user", content: "ok" }],
        max_tokens: 5,
        stream: false,
      }),
    });
    console.log(res.ok ? "conexão ok ✓" : `falhou (HTTP ${res.status}) — confira a chave`);
  } catch (err) {
    console.log(`sem resposta (${err.message}) — rode novamente quando estiver online`);
  }
}

console.log(`
  Pronto. Próximos passos:

    npm run dev            → abra http://localhost:3000
    npm test               → testes do núcleo local
    vercel --prod          → publique com cron 24/7 (vercel.json)

  Supabase (opcional, para memória na nuvem):
    1. crie um projeto em https://supabase.com
    2. rode supabase/schema.sql no SQL Editor
    3. preencha as três variáveis SUPABASE_* / NEXT_PUBLIC_SUPABASE_* no .env.local
`);

rl.close();
