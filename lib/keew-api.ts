/**
 * Keew IA — identidade da API própria.
 *
 * A Keew expõe **uma** API (`/api/v1/*`). O usuário e qualquer cliente externo
 * falam apenas com a Keew: existe um só nome de modelo ("keew"), uma só chave
 * (`x-keew-key`) e um só formato de resposta. Qualquer motor que esteja por
 * baixo é detalhe de infraestrutura e nunca aparece na interface nem nos erros.
 */

export const KEEW_API = {
  /** nome público — é o único "modelo" que o mundo enxerga */
  model: "keew-1",
  displayName: "Keew 1",
  vendor: "Keew IA",
  version: "1.0.0",
  /** famílias de raciocínio que compõem a Keew */
  lineage: "keew-core · keew-reason",
  docs: "/api/v1",
} as const;

/** Chave de acesso à API própria (vazio = API aberta). */
export function apiKey(): string {
  return (process.env.KEEW_ACCESS_KEY || "").trim();
}

/**
 * Valida o chamador.
 * A Keew aceita a chave no header `x-keew-key` ou como `Authorization: Bearer`.
 * Sem `KEEW_ACCESS_KEY` configurada a API fica aberta (modo demo).
 */
export function authorize(headers: Headers): { ok: true } | { ok: false; status: number; error: string } {
  const expected = apiKey();
  if (!expected) return { ok: true };

  const header = headers.get("x-keew-key")?.trim();
  const bearer = headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const given = header || bearer || "";

  if (!given) return { ok: false, status: 401, error: "Chave da Keew ausente." };
  // comparação de tempo constante contra ataques de temporização
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  const same = a.length === b.length && Buffer.compare(a, b) === 0;
  return same ? { ok: true } : { ok: false, status: 403, error: "Chave da Keew inválida." };
}

/** Erros sempre na voz da Keew — nunca vazam nome de fornecedor ou de motor. */
export const KEEW_ERRORS = {
  overloaded: "A Keew está com alta demanda agora. Tente novamente em instantes.",
  unavailable: "Não consegui concluir o raciocínio agora. Seu histórico está seguro — tente de novo.",
  badRequest: "Não entendi o pedido. Envie as mensagens no formato documentado em /api/v1.",
  unauthorized: "Chave da Keew ausente.",
  forbidden: "Chave da Keew inválida.",
  tooMany: "Muitas mensagens em pouco tempo.",
} as const;

/** Remove qualquer nome de fornecedor que um erro de infraestrutura possa trazer. */
export function sanitize(raw: string): string {
  const cleaned = raw
    .replace(/\b(deepseek|openrouter|groq|together|gemini|anthropic|openai|ollama|vllm|huggingface)\b/gi, "Keew")
    .replace(/sk-[A-Za-z0-9_-]{10,}/g, "sk-•••")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || KEEW_ERRORS.unavailable;
}
