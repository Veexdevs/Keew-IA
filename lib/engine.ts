/**
 * Keew IA — motor de linguagem.
 *
 * O núcleo determinístico (lib/local-engine.ts) sempre funciona. O motor de
 * linguagem é o que permite responder qualquer assunto, e ele só roda quando
 * existe uma chave de API no servidor. Esta função responde, em uma frase
 * clara, se o motor está ligado — para a interface poder ser honesta com o
 * usuário em vez de prometer o que não entrega.
 */
import { isConfigured, resolveConfig } from "./provider";

export type EngineState = {
  /** o motor de linguagem está conectado? */
  ready: boolean;
  /** rótulo curto para a interface */
  label: string;
  /** explicação em uma linha, sem jargão */
  detail: string;
};

export function engineState(): EngineState {
  let ready = false;
  try {
    ready = isConfigured(resolveConfig());
  } catch {
    ready = false;
  }

  return ready
    ? {
        ready: true,
        label: "conectado",
        detail: "A Keew responde qualquer assunto.",
      }
    : {
        ready: false,
        label: "não conectado",
        detail:
          "Sem motor de linguagem, a Keew responde conta, data, conversão, texto e seus documentos.",
      };
}
