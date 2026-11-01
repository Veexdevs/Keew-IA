/**
 * Keew IA — Núcleo de Raciocínio Local (KRL)
 * ═════════════════════════════════════════════════════════════════════════════
 * A camada de IA que a Keew executa com recursos próprios, sem depender de
 * sem depender de nada externo: análise simbólica, matemática de precisão,
 * conversão de unidades, raciocínio temporal, sumarização extrativa,
 * transformações de texto e recuperação sobre a base de conhecimento.
 *
 * É determinístico e auditável — cada resposta mostra o caminho de raciocínio.
 * Quando o pedido excede o que o núcleo resolve com confiança, o gateway
 * escala para o modelo de linguagem e o KRL funde as duas respostas.
 */

import type { KnowledgeDoc } from "./types";
import { tokenize } from "./knowledge";

export type EngineResult = {
  answer: string;
  reasoning?: string;
  confidence: number;
  skill: string;
  /** true when the answer is complete without the LLM */
  terminal: boolean;
};

/* ══════════════════════════════════════════════════════════════════ MATH ══ */

type Tok = { t: "num" | "op" | "fn" | "lp" | "rp" | "comma"; v: string };

const FUNCS: Record<string, (n: number, n2?: number) => number> = {
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, ln: Math.log, log: Math.log10,
  log2: Math.log2, exp: Math.exp, sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan, round: Math.round,
  floor: Math.floor, ceil: Math.ceil, sign: Math.sign,
  pow: (a, b) => Math.pow(a, b ?? 1),
  min: (a, b) => Math.min(a, b ?? a), max: (a, b) => Math.max(a, b ?? a),
};

const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E, tau: Math.PI * 2 };

function lex(expr: string): Tok[] {
  const s = expr
    .toLowerCase()
    .replace(/,/g, ".")               // decimal comma (pt-BR) → dot
    .replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-")
    .replace(/\bx\b/g, "*")           // 2 x 3
    .replace(/\^/g, "^")
    // "15% de 240" / "15% of 240" → "15/100*240"
    .replace(/(\d+(?:[.,]\d+)?)\s*%\s*(?:de|do|da|of)\s*/g, "$1/100*")
    .replace(/(\d)\s*%/g, " $1/100")  // other percentages become fractions
    .replace(/%/g, "/100")
    .replace(/\b(?:de|do|da|of|vezes|times)\b/g, "*")
    .replace(/\bpi\b/g, `${Math.PI}`)
    .replace(/\btau\b/g, `${Math.PI * 2}`);
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      if (s[j] === "e" && /[0-9+\-]/.test(s[j + 1] ?? "")) { j++; while (j < s.length && /[0-9+\-]/.test(s[j])) j++; }
      out.push({ t: "num", v: s.slice(i, j) });
      i = j;
      continue;
    }
    if (/[a-z]/.test(c)) {
      let j = i;
      while (j < s.length && /[a-z0-9]/.test(s[j])) j++;
      const word = s.slice(i, j);
      out.push(CONSTS[word] !== undefined ? { t: "num", v: String(CONSTS[word]) } : { t: "fn", v: word });
      i = j;
      continue;
    }
    if ("+-*/^%".includes(c)) { out.push({ t: "op", v: c }); i++; continue; }
    if (c === "(") { out.push({ t: "lp", v: c }); i++; continue; }
    if (c === ")") { out.push({ t: "rp", v: c }); i++; continue; }
    return [];                        // unknown char → not an expression
  }
  return out;
}

/** Recursive-descent evaluator (no eval, no injection surface). */
function evaluate(tokens: Tok[]): number | null {
  let pos = 0;
  const peek = () => tokens[pos];
  const eat = () => tokens[pos++];

  function primary(): number | null {
    const tk = peek();
    if (!tk) return null;
    if (tk.t === "num") { eat(); return parseFloat(tk.v); }
    if (tk.t === "op" && (tk.v === "-" || tk.v === "+")) { eat(); const v = primary(); return v === null ? null : tk.v === "-" ? -v : v; }
    if (tk.t === "lp") { eat(); const v = expr(); if (!peek() || peek().t !== "rp") return null; eat(); return v; }
    if (tk.t === "fn") {
      eat();
      const fn = FUNCS[tk.v];
      if (!fn) return null;
      let a = 1; let b: number | undefined;
      if (peek()?.t === "lp") {
        eat();
        const first = expr(); if (first === null) return null;
        a = first;
        if (peek()?.t === "comma") { eat(); const second = expr(); if (second === null) return null; b = second; }
        if (peek()?.t !== "rp") return null; eat();
      }
      return fn(a, b);
    }
    return null;
  }

  function power(): number | null {
    const base = primary();
    if (base === null) return null;
    const tk = peek();
    if (tk?.t === "op" && tk.v === "^") { eat(); const e = power(); return e === null ? null : Math.pow(base, e); }
    // implicit multiplication: 2(3+4) or 2pi
    if (tk && (tk.t === "lp" || tk.t === "fn" || (tk.t === "num" && false))) {
      const rhs = power(); return rhs === null ? null : base * rhs;
    }
    return base;
  }

  function term(): number | null {
    let v = power();
    if (v === null) return null;
    while (peek()?.t === "op" && "*/%".includes(peek()!.v)) {
      const op = eat()!.v;
      const rhs = power();
      if (rhs === null) return null;
      v = op === "*" ? v * rhs : op === "/" ? v / rhs : v % rhs;
    }
    return v;
  }

  function expr(): number | null {
    let v = term();
    if (v === null) return null;
    while (peek()?.t === "op" && (peek()!.v === "+" || peek()!.v === "-")) {
      const op = eat()!.v;
      const rhs = term();
      if (rhs === null) return null;
      v = op === "+" ? v + rhs : v - rhs;
    }
    return v;
  }

  const result = expr();
  if (result === null || pos !== tokens.length || !Number.isFinite(result)) return null;
  return result;
}

const fmtNum = (n: number): string => {
  if (!Number.isFinite(n)) return n > 0 ? "∞" : "-∞";
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return n.toLocaleString("pt-BR");
  const abs = Math.abs(n);
  if (abs !== 0 && (abs < 1e-4 || abs >= 1e12)) {
    return n.toExponential(4).replace("e", " × 10^").replace("+", "");
  }
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 4 : 6;
  const rounded = parseFloat(n.toFixed(digits));
  return rounded.toLocaleString("pt-BR", { maximumFractionDigits: digits });
};

/** Strip the question wrapper and keep the raw expression. */
function extractExpression(text: string): string | null {
  const t = text
    .replace(/[?？!]/g, " ")
    .replace(/\b(quanto|quanto é|quanto vale|qual o valor de|calcule|calcula|resolva|compute|resultado de|me diga|e|é)\b/gi, " ")
    .trim();
  const m = t.match(/[-+*/^%().,\d\s×÷−a-zA-Z]{3,}/);
  if (!m) return null;
  const candidate = m[0].trim();
  if (!/\d/.test(candidate)) return null;
  if (!/[-+*/^%]|sqrt|log|sin|cos|tan|pow/.test(candidate)) return null;
  return candidate;
}

export function tryMath(text: string): EngineResult | null {
  const expr = extractExpression(text);
  if (!expr) return null;
  const tokens = lex(expr);
  if (!tokens.length || tokens.length > 200) return null;
  const value = evaluate(tokens);
  if (value === null) return null;

  const pretty = expr.replace(/\s+/g, " ").trim();
  const reasoning = [
    "1. Interpretei a entrada como uma expressão aritmética.",
    `2. Normalizei para a forma canônica: \`${pretty}\`.`,
    "3. Resolvi respeitando precedência (potência → multiplicação/divisão → soma/subtração) e parênteses.",
    "4. Verifiquei o resultado com o avaliador determinístico do núcleo (sem execução de código arbitrário).",
  ].join("\n");

  return {
    skill: "math",
    terminal: true,
    confidence: 0.99,
    reasoning,
    answer:
      `**${pretty} = ${fmtNum(value)}**\n\n` +
      (Number.isFinite(value) && !Number.isInteger(value)
        ? `Aproximando: ${parseFloat(value.toFixed(4)).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}.`
        : `Resultado exato.`) +
      "\n\n> Calculado pelo núcleo de raciocínio local da Keew IA — determinístico, sem chamada externa.",
  };
}

/* ══════════════════════════════════════════════════════ UNIT CONVERSION ══ */

type Unit = { aliases: string[]; dim: string; toBase: number; label: string };

const UNITS: Unit[] = [
  { aliases: ["km", "quilometro", "quilometros", "kilometro"], dim: "len", toBase: 1000, label: "km" },
  { aliases: ["m", "metro", "metros"], dim: "len", toBase: 1, label: "m" },
  { aliases: ["cm", "centimetro", "centimetros"], dim: "len", toBase: 0.01, label: "cm" },
  { aliases: ["mm", "milimetro", "milimetros"], dim: "len", toBase: 0.001, label: "mm" },
  { aliases: ["mi", "milha", "milhas", "mile", "miles"], dim: "len", toBase: 1609.344, label: "mi" },
  { aliases: ["ft", "pe", "pes", "feet"], dim: "len", toBase: 0.3048, label: "ft" },
  { aliases: ["in", "polegada", "polegadas", "inch"], dim: "len", toBase: 0.0254, label: "in" },
  { aliases: ["kg", "quilo", "quilos", "kilograma"], dim: "mass", toBase: 1, label: "kg" },
  { aliases: ["g", "grama", "gramas"], dim: "mass", toBase: 0.001, label: "g" },
  { aliases: ["t", "tonelada", "toneladas"], dim: "mass", toBase: 1000, label: "t" },
  { aliases: ["lb", "libra", "libras", "pound", "pounds"], dim: "mass", toBase: 0.45359237, label: "lb" },
  { aliases: ["oz", "onca", "oncas"], dim: "mass", toBase: 0.028349523125, label: "oz" },
  { aliases: ["l", "litro", "litros"], dim: "vol", toBase: 1, label: "L" },
  { aliases: ["ml", "mililitro", "mililitros"], dim: "vol", toBase: 0.001, label: "mL" },
  { aliases: ["gal", "galao", "galoes", "gallon"], dim: "vol", toBase: 3.785411784, label: "gal" },
  { aliases: ["kb"], dim: "data", toBase: 1000, label: "KB" },
  { aliases: ["mb"], dim: "data", toBase: 1e6, label: "MB" },
  { aliases: ["gb"], dim: "data", toBase: 1e9, label: "GB" },
  { aliases: ["tb"], dim: "data", toBase: 1e12, label: "TB" },
  { aliases: ["s", "segundo", "segundos"], dim: "time", toBase: 1, label: "s" },
  { aliases: ["min", "minuto", "minutos"], dim: "time", toBase: 60, label: "min" },
  { aliases: ["h", "hora", "horas"], dim: "time", toBase: 3600, label: "h" },
  { aliases: ["dia", "dias"], dim: "time", toBase: 86400, label: "d" },
];

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\.$/, "").trim();

function findUnit(word: string): Unit | undefined {
  const w = norm(word);
  return UNITS.find((u) => u.aliases.includes(w));
}

export function tryConversion(text: string): EngineResult | null {
  // 42 km para milhas · 180 lbs em kg · 30 °C em °F
  const temp = text.match(/(-?\d+(?:[.,]\d+)?)\s*°?\s*(c|f|celsius|fahrenheit)\b[^a-z]*(?:para|em|to|->|→)?\s*(?:°?\s*)?(c|f|celsius|fahrenheit)\b/i);
  if (temp) {
    const v = parseFloat(temp[1].replace(",", "."));
    const from = temp[2].toLowerCase()[0];
    const to = temp[3].toLowerCase()[0];
    const c = from === "c" ? v : ((v - 32) * 5) / 9;
    const out = to === "c" ? c : (c * 9) / 5 + 32;
    return {
      skill: "units",
      terminal: true,
      confidence: 0.99,
      reasoning: `°C = (°F − 32) × 5/9 · °F = °C × 9/5 + 32`,
      answer: `**${fmtNum(v)} °${from.toUpperCase()} = ${fmtNum(out)} °${to.toUpperCase()}**\n\n> Conversão executada localmente pelo núcleo Keew.`,
    };
  }

  const m = text.match(/(-?\d+(?:[.,]\d+)?)\s*([a-zA-Zçãáéíóúµ.]+)\s*(?:para|em|to|->|→|=>)\s*([a-zA-Zçãáéíóúµ.]+)/);
  if (!m) return null;
  const value = parseFloat(m[1].replace(",", "."));
  const from = findUnit(m[2]);
  const to = findUnit(m[3]);
  if (!from || !to || from.dim !== to.dim) return null;
  const out = (value * from.toBase) / to.toBase;
  return {
    skill: "units",
    terminal: true,
    confidence: 0.98,
    reasoning: `Converti para a unidade base do grupo "${from.dim}" e depois para a unidade de destino (fator ${fmtNum(from.toBase / to.toBase)}).`,
    answer: `**${fmtNum(value)} ${from.label} = ${fmtNum(out)} ${to.label}**\n\n> Conversão executada localmente pelo núcleo Keew.`,
  };
}

/* ════════════════════════════════════════════════════════════════ TIME ══ */

const WEEKDAYS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

export function tryDateTime(text: string, now = new Date()): EngineResult | null {
  const t = norm(text);
  const wantsDate = /(que dia|data de hoje|hoje e|dia da semana|que horas|hora agora|timestamp|calendario)/.test(t);
  if (wantsDate) {
    const dtf = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "full", timeStyle: "short", timeZone: "America/Sao_Paulo",
    });
    return {
      skill: "datetime",
      terminal: true,
      confidence: 0.99,
      reasoning: "Consultei o relógio do sistema e formatei com Intl (America/Sao_Paulo).",
      answer:
        `**${dtf.format(now)}** (horário de Brasília)\n\n` +
        `- UTC: ${now.toISOString()}\n` +
        `- Timestamp Unix: \`${Math.floor(now.getTime() / 1000)}\`\n` +
        `- Semana ISO: ${isoWeek(now)}`,
    };
  }

  // diferença entre datas: "de 2024-01-01 até 2025-03-15"
  const dates = [...text.matchAll(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/g)].map((m) => {
    const [, d, mo, y] = m;
    const year = y.length === 2 ? 2000 + parseInt(y, 10) : parseInt(y, 10);
    return new Date(Date.UTC(year, parseInt(mo, 10) - 1, parseInt(d, 10)));
  });
  if (dates.length >= 2 && /(diferenca|entre|ate|desde|dias)/.test(t)) {
    const [a, b] = dates;
    const days = Math.round(Math.abs(b.getTime() - a.getTime()) / 86400000);
    return {
      skill: "datetime",
      terminal: true,
      confidence: 0.97,
      reasoning: "Subtraí os timestamps e converti milissegundos em dias.",
      answer:
        `**${days.toLocaleString("pt-BR")} dias** entre ${a.toLocaleDateString("pt-BR", { timeZone: "UTC" })} e ${b.toLocaleDateString("pt-BR", { timeZone: "UTC" })}.\n\n` +
        `- Semanas: ${(days / 7).toFixed(2)}\n- Meses (média): ${(days / 30.4375).toFixed(2)}\n- Anos: ${(days / 365.25).toFixed(3)}`,
    };
  }
  return null;
}

function isoWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/* ════════════════════════════════════════════════════════════════ TEXT ══ */

export function tryTextOps(text: string): EngineResult | null {
  const t = norm(text);

  const wantsDecode = /(decodif|decode|descriptograf|unbase64)/.test(t);
  const b64dec = text.match(/(?:decodif\w*|decode|descriptograf\w*)[^:\-]*[:\-]?\s*`?([A-Za-z0-9+/=]{4,})`?/i);
  if (wantsDecode && b64dec) {
    try {
      const decoded = Buffer.from(b64dec[1], "base64").toString("utf8");
      if (decoded && /[\x20-\x7E\u00C0-\u017F]/.test(decoded)) {
        return {
          skill: "text",
          terminal: true, confidence: 0.95,
          reasoning: "Decodifiquei a string em base64 com Buffer (UTF-8).",
          answer: `**Resultado:**\n\`\`\`\n${decoded}\n\`\`\``,
        };
      }
    } catch { /* ignore */ }
  }
  if (!wantsDecode && /(base64|codif|encode)/.test(t)) {
    const afterColon = text.includes(":") ? text.slice(text.lastIndexOf(":") + 1) : "";
    const payload = (afterColon || text.replace(/^.*?(?:base64|codif\w*|encode)\s*(?:em|para|to)?\s*[:\-]?\s*/i, "")).trim();
    if (payload.length > 2) {
      return {
        skill: "text", terminal: true, confidence: 0.9,
        reasoning: "Codifiquei o texto em base64 (UTF-8).",
        answer: `\`${Buffer.from(payload).toString("base64")}\``,
      };
    }
  }

  if (/(slug)/.test(t)) {
    const payload = text.replace(/^.*?slug\s*(?:de|da|do)?\s*[:\-]?\s*/i, "").trim();
    if (payload) {
      const slug = norm(payload).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      return { skill: "text", terminal: true, confidence: 0.95, reasoning: "Normalizei, removi acentos e substituí separadores.", answer: `\`${slug}\`` };
    }
  }

  if (/(quantas palavras|contar palavras|word count|quantos caracteres|contar caracteres)/.test(t)) {
    const body = text.split(/[:：]/).slice(1).join(":").trim() || text.replace(/.*?(palavras|caracteres)\s*[:\-]?\s*/i, "").trim();
    const words = body.split(/\s+/).filter(Boolean).length;
    return {
      skill: "text", terminal: true, confidence: 0.99,
      reasoning: "Segmentação por espaços + contagem de code points.",
      answer: `- Palavras: **${words.toLocaleString("pt-BR")}**\n- Caracteres: **${[...body].length.toLocaleString("pt-BR")}**\n- Linhas: **${body.split("\n").length.toLocaleString("pt-BR")}**\n- Tempo de leitura (~200 wpm): **${Math.max(1, Math.round(words / 200))} min**`,
    };
  }

  if (/(valide|validar|formate|formatar|pretty)\s*(o\s*)?json|json\s*(valido|formatado)/i.test(norm(text))) {
    const body = text.slice(text.indexOf("{"));
    try {
      const parsed = JSON.parse(body.slice(0, body.lastIndexOf("}") + 1));
      return {
        skill: "text", terminal: true, confidence: 0.95,
        reasoning: "Parse com JSON.parse e reimpressão com indentação 2.",
        answer: "JSON válido ✅\n\n```json\n" + JSON.stringify(parsed, null, 2) + "\n```",
      };
    } catch (e) {
      return {
        skill: "text", terminal: true, confidence: 0.95,
        reasoning: "JSON.parse lançou erro; reportei a posição.",
        answer: `JSON inválido ❌\n\n\`${(e as Error).message}\``,
      };
    }
  }

  if (/(regex|expressao regular)/.test(t)) {
    return {
      skill: "text", terminal: true, confidence: 0.8,
      reasoning: "Preparando um laboratório de regex para testar no cliente.",
      answer:
        "Posso montar a expressão com você — informe **padrão desejado** e **2 exemplos** (um que deve casar e outro que não).\n\n" +
        "Enquanto isso, referência rápida:\n\n| Token | Significado |\n| --- | --- |\n| `^` `$` | início / fim |\n| `\\d` `\\w` `\\s` | dígito, palavra, espaço |\n| `*` `+` `?` | 0+, 1+, opcional |\n| `{n,m}` | repetição entre n e m |\n| `(?:…)` | grupo sem captura |\n| `(?=…)` | lookahead |",
    };
  }

  return null;
}

/* ══════════════════════════════════════════════════════ SUMMARIZATION ══ */

export function summarize(raw: string): EngineResult | null {
  const text = raw
    .replace(/^\s*(?:resuma|resumir|resumo|faça um resumo(?: de| do| da)?|summarize)\s*(?:este|esse|o|a|isto|isso)?\s*(?:texto|documento|conte[uú]do)?\s*[:\-]?\s*/i, "")
    .trim();
  if (text.split(/\s+/).length < 90) return null;

  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…])\s+/)
    .filter((s) => s.split(" ").length > 4);
  if (sentences.length < 4) return null;

  const df = new Map<string, number>();
  const bags = sentences.map((s) => {
    const toks = tokenize(s);
    for (const t of new Set(toks)) df.set(t, (df.get(t) || 0) + 1);
    return toks;
  });
  const scored = sentences.map((s, i) => {
    let score = 0;
    const tf = new Map<string, number>();
    for (const t of bags[i]) tf.set(t, (tf.get(t) || 0) + 1);
    for (const [t, c] of tf) score += (c / bags[i].length) * Math.log(1 + sentences.length / (df.get(t) || 1));
    if (i === 0) score *= 1.25;                       // lead bias
    if (/\b(portanto|conclus|resumo|resultado|logo)\b/i.test(s)) score *= 1.15;
    score /= Math.sqrt(s.split(" ").length);           // length penalty
    return { s, i, score };
  });

  const take = Math.max(3, Math.min(6, Math.round(sentences.length * 0.28)));
  const picked = [...scored].sort((a, b) => b.score - a.score).slice(0, take).sort((a, b) => a.i - b.i);
  const keywords = [...df.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w);

  const words = text.split(/\s+/).length;
  return {
    skill: "summarize",
    terminal: true,
    confidence: 0.9,
    reasoning:
      "Apliquei sumarização extrativa: tokenização, TF-IDF por sentença, penalização por comprimento, " +
      `bias de abertura e seleção das ${take} sentenças mais informativas em ordem original.`,
    answer:
      `## Resumo\n\n${picked.map((p) => `- ${p.s.trim()}`).join("\n")}\n\n` +
      `**Palavras-chave:** ${keywords.map((k) => `\`${k}\``).join(" · ")}\n\n` +
      `_Redução: ${words} → ${picked.reduce((a, p) => a + p.s.split(" ").length, 0)} palavras ` +
      `(${Math.round((1 - picked.reduce((a, p) => a + p.s.split(" ").length, 0) / words) * 100)}%). Executado no núcleo local._`,
  };
}

/* ══════════════════════════════════════════════════════════ KNOWLEDGE ══ */

export function tryKnowledge(
  query: string,
  docs: KnowledgeDoc[],
): EngineResult | null {
  if (!docs.length) return null;
  const q = new Set(tokenize(query));
  if (q.size < 2) return null;

  // score against the title for topical weighting, and require either a title
  // hit or at least two body hits — one shared word is coincidence, not intent.
  const ranked = docs
    .map((d) => {
      const titleTokens = new Set(tokenize(d.title));
      const bodyTokens = new Set(tokenize(`${d.title} ${d.content}`));
      let titleHits = 0;
      let bodyHits = 0;
      for (const t of q) {
        if (titleTokens.has(t)) titleHits++;
        else if (bodyTokens.has(t)) bodyHits++;
      }
      return { d, titleHits, bodyHits, score: (titleHits * 2 + bodyHits) / (q.size * 2) };
    })
    // a title match is a strong signal; a body-only match needs real coverage
    .filter((r) => r.titleHits >= 1 || r.bodyHits >= Math.max(3, Math.ceil(q.size * 0.5)))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (!ranked.length) return null;
  const best = ranked[0];
  const paragraphs = best.d.content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const relevant = paragraphs
    .map((p) => {
      const toks = new Set(tokenize(p));
      let hits = 0;
      for (const t of q) if (toks.has(t)) hits++;
      return { p, hits };
    })
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 2)
    .map((x) => x.p);

  return {
    skill: "knowledge",
    terminal: true,
    confidence: 0.74 + best.score * 0.2,
    reasoning: `Recuperei ${ranked.length} documento(s) por similaridade lexical (cobertura de termos: ${(best.score * 100).toFixed(0)}%) e reordenei os parágrafos por relevância.`,
    answer:
      `${(relevant.length ? relevant : [best.d.content.slice(0, 700)]).join("\n\n")}\n\n` +
      `---\n**Fontes (${ranked.length}):** ` +
      ranked.map((r) => `\`${r.d.title}\``).join(" · "),
  };
}

/* ══════════════════════════════════════════════════════════ PLANNING ══ */

const PLAN_VERBS = /(planeje|plano|como faco|como fazer|como criar|como construir|passo a passo|roadmap|estrategia|implemente|implementar|monte|montar|desenvolva|construa)/i;

export function tryPlan(text: string): EngineResult | null {
  if (!PLAN_VERBS.test(text) || text.length > 1200) return null;
  const goal = text.replace(/^(planeje|monte|estrategia para|como (faco|fazer|faco para|criar|construir))\s*/i, "").trim();
  if (goal.length < 8) return null;

  const steps = [
    `**Definir o resultado** — escreva em uma frase o que fica pronto ao final: "${goal.slice(0, 120)}".`,
    "**Mapear restrições** — prazo, orçamento, stack existente, quem aprova e o que não pode mudar.",
    "**Quebrar em entregáveis** — cada item precisa ser verificável por alguém fora do projeto.",
    "**Priorizar por risco** — ataque primeiro o item que, se der errado, invalida os outros.",
    "**Construir a fatia mínima** — a menor versão que roda de ponta a ponta, mesmo feia.",
    "**Instrumentar** — log, métrica e um alerta antes de ampliar o alcance.",
    "**Revisar e ampliar** — só aumenta escopo depois que a fatia mínima se provou estável.",
  ];
  return {
    skill: "plan",
    terminal: false,
    confidence: 0.7,
    reasoning: "Estruturei o pedido em sete etapas (definição → restrições → entregáveis → risco → fatia mínima → instrumentação → ampliação), padrão de execução do workspace.",
    answer:
      `### Plano de execução\n\n${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n` +
      `**Riscos típicos:** escopo crescendo sem marcar o que sai; ausência de critério de "pronto"; dependência de uma única pessoa.\n\n` +
      `**Próximo passo concreto:** me diga a stack e o prazo e eu detalho os entregáveis do item 3 item por item.`,
  };
}

/* ══════════════════════════════════════════════════════════ SOCIAL ══ */

/** Small talk stays warm, short and honest about what the core can do. */
const norm2 = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[!?.,;:]/g, " ").replace(/\s+/g, " ").trim();

/** True when every word of one phrase appears in the other (order-insensitive). */
function covers(a: string, b: string): boolean {
  const A = new Set(norm2(a).split(" ").filter(Boolean));
  const B = new Set(norm2(b).split(" ").filter(Boolean));
  if (!A.size || !B.size) return false;
  const [small, big] = A.size <= B.size ? [A, B] : [B, A];
  return [...small].every((w) => big.has(w));
}

export function trySocial(text: string): EngineResult | null {
  const t = norm(text).replace(/[!?.,;]+/g, " ").replace(/\s+/g, " ").trim();
  // a greeting is short and made only of greeting fragments: "oi, tudo bem?"
  const GREET = /^(oi+|ola+|opa|eai|e ai|bom dia|boa tarde|boa noite|hey|hi|hello|salve|fala ai|tudo bem|tudo bom|tudo certo|como vai|como voce esta|beleza|blz|suave|na paz|ai|tudo tranquilo|tranquilo|tudo bem com voce|tudo bom com voce|como voce ta|como vc ta)$/;
  // "oi, tudo bem?" → two greeting fragments; "bom dia" → one. Both are greetings.
  const parts = text
    // separators, then greetings glued without punctuation ("oi tudo certo")
    .split(/\s*[,;.!?]\s*|\s+e\s+|\s+(?=(?:tudo (?:bem|certo|bom)|como vai)\b)/)
    .map((f) => norm(f).replace(/[!?.,;]+/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const isGreeting =
    t.length <= 32 &&
    (GREET.test(t) ||
      (parts.length > 1 && parts.every((f) => GREET.test(f))) ||
      parts.some((f) => GREET.test(f) && f.split(" ").length >= 2));
  if (isGreeting) {
    return {
      skill: "social",
      terminal: true,
      confidence: 0.95,
      reasoning: "Saudação reconhecida — resposta curta do núcleo local.",
      answer:
        "Oi. Keew IA aqui — núcleo local ativo.\n\n" +
        "Resolvo na hora **cálculos**, **conversões de unidade**, **datas e prazos**, **resumos**, " +
        "**JSON/base64/slug** e **busca na base de conhecimento** — e para conversa aberta eu penso com o " +
        "Keew Reason.\n\n" +
        "O que você precisa?",
    };
  }
  if (/^(obrigad|valeu|thanks|thank you|agradec)/.test(t)) {
    return { skill: "social", terminal: true, confidence: 0.9, reasoning: "Agradecimento.", answer: "Por nada. Quando quiser, chama." };
  }
  if (/^(quem (e|es) voce|seu nome|o que voce e|o que voce faz|qual seu papel|apresente se)/.test(t)) {
    return {
      skill: "social",
      terminal: true,
      confidence: 0.95,
      reasoning: "Identidade da Keew no corpus nativo.",
      answer:
        "Sou a **Keew IA** — a inteligência artificial própria da Veexdevs.\n\n" +
        "| | |\n| --- | --- |\n" +
        "| Núcleo | Keew Core — raciocínio determinístico (math, datas, unidades, resumo, conhecimento) |\n" +
        "| Razão | Keew Reason — raciocínio profundo para conversa aberta, código e análise |\n" +
        "| Plataformas | Web, PWA, APK Android, IPA iOS, EXE/DMG/AppImage |\n" +
        "| Agentes | Core, Engenheiro, Analista, Redator, Pesquisador, Tutor + os seus |\n" +
        "| Automação | 24/7, sem precisar de você |\n\n" +
        "Tudo isso num workspace com 14 temas. O que vamos resolver?",
    };
  }
  if (
    /(o que (voce )?pode fazer|suas (capacidades|habilidades)|comandos disponiveis)/.test(t) ||
    (covers(t, "ajuda") && t.split(" ").length <= 3) ||
    (covers(t, "help") && t.split(" ").length <= 3)
  ) {
    return {
      skill: "social",
      terminal: true,
      confidence: 0.9,
      reasoning: "Mapeei as habilidades do núcleo determinístico e as que o Keew Reason completa.",
      answer:
        "Trabalho em dois níveis — e o primeiro não precisa de internet.\n\n" +
        "**Agora, só com o núcleo local**\n\n" +
        "| Peça assim | Eu faço |\n| --- | --- |\n" +
        "| `(1847 * 23) / 7 + sqrt(256)` | aritmética exata, respeitando precedência |\n" +
        "| `15% de 240` | porcentagem |\n" +
        "| `180 lb em kg` · `30 °C em °F` | unidades e temperatura |\n" +
        "| `que dia é hoje` · `dias entre 01/01/2026 e 31/03/2026` | datas, prazos, semana ISO |\n" +
        "| cole um texto e escreva `resuma` | resumo extrativo com palavras-chave |\n" +
        "| `slug de Café com Leite` · `codifique em base64: keew` · `valide este json` | transformação de texto |\n" +
        "| `quem é a Keew IA` · dúvidas sobre seus documentos | base de conhecimento |\n\n" +
        "**Sempre, com o Keew Reason**: conversa aberta, código de produção, redação, análise de dados " +
        "e raciocínio longo passo a passo.\n\n" +
        "Atalhos: `⌘K` comandos · `⌘J` nova conversa · `⌘\\` alternar menu.",
    };
  }
  return null;
}

/** Derives a list from a sentence: "liste 5 formas de X". */
export function tryList(text: string): EngineResult | null {
  const m = text.match(/\b(?:liste|listar|cite|citar|enumere|enumera|de|mostre)\b\s*(?:me\s*)?(\d{1,2})?\s*(?:\w+\s+){0,3}(?:de|para|sobre|que)\s+(.{4,120})/i);
  if (!m) return null;
  const count = Math.min(parseInt(m[1] || "5", 10) || 5, 10);
  const topic = m[2].replace(/[?.!]+$/, "").trim();
  if (topic.length < 4) return null;

  const angles = [
    "fundamento — o princípio que sustenta o tema",
    "prática — como aplicar no dia a dia",
    "erro comum — o que costuma dar errado",
    "métrica — como saber se está funcionando",
    "variação — uma alternativa menos óbvia",
    "custo — o preço (tempo, dinheiro, atenção)",
    "risco — o pior cenário realista",
    "sequência — a ordem que reduz retrabalho",
    "ferramenta — o que reduz o esforço manual",
    "manutenção — o que precisa durar depois do lançamento",
  ];
  return {
    skill: "list",
    terminal: false,
    confidence: 0.55,
    reasoning: `Estruturei "${topic}" em ${count} ângulos (fundamento, prática, erro, métrica, variação…) para não repetir a mesma ideia.`,
    answer:
      `### ${count} caminhos para "${topic}"\n\n` +
      angles.slice(0, count).map((a, i) => `${i + 1}. **${a.split(" — ")[0].replace(/^./, (c) => c.toUpperCase())}** — ${a.split(" — ")[1]}.`).join("\n") +
      "\n\nQuer que eu aprofunde um deles com exemplos concretos?",
  };
}

/* ══════════════════════════════════════════════════════════ FALLBACK ══ */

export function fallback(query: string): EngineResult {
  const q = query.trim();
  const topic = q.length > 90 ? `${q.slice(0, 90)}…` : q;
  return {
    skill: "fallback",
    terminal: true,
    confidence: 1,
    reasoning: "Fora do alcance do núcleo determinístico; nenhum motor de linguagem está conectado.",
    answer:
      `Não consigo responder isso.\n\n` +
      `**"${topic}"** é uma pergunta de linguagem aberta, e o núcleo da Keew que está rodando aqui é ` +
      `determinístico: ele resolve conta, data, conversão de unidade, transformação de texto e busca nos ` +
      `seus documentos — não redige nem interpreta texto livre.\n\n` +
      `Para a Keew responder qualquer assunto, falta conectar o motor de linguagem dela em ` +
      `Configurações → Motor, colando uma chave. Enquanto isso não acontece, prefiro te dizer isso ` +
      `do que inventar uma resposta.\n\n` +
      `**O que eu resolvo agora:**\n\n` +
      `| Peça | Exemplo |\n` +
      `| --- | --- |\n` +
      `| conta e porcentagem | \`calcule 15% de 240\` |\n` +
      `| conversão de unidade | \`180 lb em kg\` |\n` +
      `| data e prazo | \`quantos dias entre hoje e 25/12\` |\n` +
      `| texto | \`slug de Café com Leite\` · \`resuma: <texto>\` |\n` +
      `| seus documentos | suba um arquivo em Conhecimento e pergunte sobre ele |`,
  };
}

/* ══════════════════════════════════════════════════════════ ENTRYPOINT ══ */

export function reason(query: string, docs: KnowledgeDoc[] = [], now = new Date()): EngineResult {
  const chain = [trySocial, tryMath, tryConversion, tryDateTime, tryTextOps, tryList, tryPlan];
  for (const fn of chain) {
    const r = fn(query, now as never);
    if (r && r.confidence >= 0.8) return r;
  }
  const knowledge = tryKnowledge(query, docs);
  if (knowledge) return knowledge;
  const summary = summarize(query);
  if (summary) return summary;
  for (const fn of chain) {
    const r = fn(query, now as never);
    if (r) return r;
  }
  return fallback(query);
}
