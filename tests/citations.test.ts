import { test } from "node:test";
import assert from "node:assert/strict";
import { extractCitations, faviconFor, tintFor } from "../lib/citations";

test("colhe links em markdown com o texto do link como título", () => {
  const r = extractCitations("Segundo o [Relatório Anual](https://exemplo.org/relatorio), cresceu.");
  const web = r.find((c) => c.url);
  assert.ok(web, "nenhuma fonte web encontrada");
  assert.equal(web!.title, "Relatório Anual");
  assert.equal(web!.url, "https://exemplo.org/relatorio");
  assert.equal(web!.kind, "web");
});

test("reconhece domínios soltos e normaliza o rótulo", () => {
  const r = extractCitations("Veja em docs.python.org e também em openai.com/blog.");
  const hosts = r.map((c) => c.url);
  assert.ok(hosts.some((u) => u?.includes("python.org")), "python.org ausente");
});

test("ignora localhost e endereços de exemplo", () => {
  const r = extractCitations("rode em http://localhost:3000 e https://example.com");
  assert.equal(r.filter((c) => c.url).length, 0);
});

test("documentos da base viram fontes do tipo knowledge", () => {
  const r = extractCitations("resposta qualquer", [
    { title: "Arquitetura da Keew", content: "A plataforma tem quatro camadas." },
  ]);
  assert.equal(r.length, 1);
  assert.equal(r[0].kind, "knowledge");
  assert.equal(r[0].title, "Arquitetura da Keew");
  assert.ok(r[0].snippet!.startsWith("A plataforma"));
});

test("não repete o mesmo domínio duas vezes", () => {
  const r = extractCitations("[Um](https://site.com/a) e [Dois](https://site.com/b) e site.com");
  const web = r.filter((c) => c.url);
  assert.equal(web.length, 1);
});

test("limita a lista a 6 fontes", () => {
  const text = ["a.com","b.com","c.com","d.com","e.com","f.com","g.com","h.com"]
    .map((d) => `[${d}](https://${d}/x)`).join(" ");
  assert.ok(extractCitations(text).length <= 6);
});

test("resposta sem material externo não gera fontes", () => {
  assert.deepEqual(extractCitations("2 + 2 = 4. Resultado exato."), []);
});

test("favicon aponta para o domínio, com tamanho válido", () => {
  const url = faviconFor("https://www.exemplo.com/pagina", 64);
  assert.match(url, /^https:\/\//);
  assert.match(url, /exemplo\.com/);
  assert.match(url, /sz=64/);
});

test("tintFor é estável e diferente por domínio", () => {
  assert.equal(tintFor("a.com"), tintFor("a.com"));
  assert.notEqual(tintFor("a.com"), tintFor("b.com"));
});
