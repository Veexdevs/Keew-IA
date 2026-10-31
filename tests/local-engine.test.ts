/**
 * Keew IA — núcleo local (KRL) regression suite.
 * Run: npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { KEEW_CORPUS } from "../lib/knowledge";
import { reason, summarize, tryConversion, tryDateTime, tryMath, tryTextOps } from "../lib/local-engine";

test("aritmética respeita precedência e parênteses", () => {
  const r = tryMath("quanto é (1847 * 23) / 7 + sqrt(256)?");
  assert.ok(r, "deveria reconhecer a expressão");
  assert.match(r!.answer, /6\.085|6\.084|6084|6085/);
});

test("potência antes da multiplicação", () => {
  const r = tryMath("2 + 3 * 4^2");
  assert.ok(r);
  assert.match(r!.answer, /= 50/);
});

test("porcentagem em pt-BR", () => {
  const r = tryMath("15% de 240");
  assert.ok(r, "porcentagem deve ser calculável");
  assert.match(r!.answer, /36/);
});

test("divisão por zero não quebra o núcleo", () => {
  assert.equal(tryMath("10 / 0"), null);
});

test("conversão de unidades", () => {
  const r = tryConversion("42 km para milhas");
  assert.ok(r);
  assert.match(r!.answer, /26/);
});

test("conversão de temperatura", () => {
  const r = tryConversion("30 °C em °F");
  assert.ok(r);
  assert.match(r!.answer, /86/);
});

test("conversão incompatível é recusada", () => {
  assert.equal(tryConversion("10 kg para km"), null);
});

test("data atual é respondida com o relógio do sistema", () => {
  const r = tryDateTime("que dia é hoje?", new Date("2026-10-31T12:00:00Z"));
  assert.ok(r);
  assert.match(r!.answer, /2026/);
});

test("diferença entre datas", () => {
  const r = tryDateTime("quantos dias entre 01/01/2026 e 31/01/2026?");
  assert.ok(r);
  assert.match(r!.answer, /30 dias/);
});

test("contagem de palavras", () => {
  const r = tryTextOps("quantas palavras: a keew ia é uma inteligência artificial própria");
  assert.ok(r);
  assert.match(r!.answer, /8/);
});

test("base64 ida e volta", () => {
  const enc = tryTextOps("codifique em base64: keew");
  assert.ok(enc);
  assert.match(enc!.answer, /a2Vldw==/);
  const dec = tryTextOps("decodifique base64: a2Vldw==");
  assert.ok(dec);
  assert.match(dec!.answer, /keew/);
});

test("JSON inválido é reportado, não lança", () => {
  const r = tryTextOps('valide o json: {"a": 1,}');
  assert.ok(r);
  assert.match(r!.answer, /inválido/i);
});

test("resumo extrativo reduz o texto", () => {
  const long = Array.from({ length: 14 }, (_, i) =>
    `A linha ${i} descreve um aspecto distinto do produto Keew IA, com detalhes sobre engenharia e operação contínua.`,
  ).join(" ");
  const r = summarize(long);
  assert.ok(r);
  assert.match(r!.answer, /Resumo/);
  assert.match(r!.answer, /Redução/);
});

test("resposta sobre identidade vem do corpus nativo", () => {
  const r = reason("quem é a Keew IA?", KEEW_CORPUS);
  assert.equal(r.skill, "knowledge");
  assert.match(r.answer, /inteligência artificial própria|Veexdevs/);
});

test("pedido sem cobertura cai no fallback com instrução de configuração", () => {
  const r = reason("escreva um soneto sobre entropia social", KEEW_CORPUS);
  assert.equal(r.terminal, false);
  assert.match(r.answer, /Configurações/);
});

test("nunca retorna vazio", () => {
  for (const q of ["", "oi", "???", "asdfghjkl", "quanto é"]) {
    const r = reason(q, KEEW_CORPUS);
    assert.ok(r.answer.length > 0, `vazio para: ${q}`);
  }
});

test("saudação recebe resposta curta do núcleo", () => {
  const r = reason("oi, tudo bem?", KEEW_CORPUS);
  assert.equal(r.skill, "social");
  assert.match(r.answer, /núcleo local/i);
});

test("identidade é respondida sem provedor", () => {
  const r = reason("quem é você?", KEEW_CORPUS);
  assert.equal(r.skill, "social");
  assert.match(r.answer, /Keew IA/);
});

test("lista pedida é estruturada", () => {
  const r = reason("liste 5 formas de reduzir latência", KEEW_CORPUS);
  assert.match(r.answer, /5 caminhos/);
});
