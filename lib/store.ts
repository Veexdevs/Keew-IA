"use client";

/**
 * Keew IA — workspace store.
 * Everything the user creates lives here and is persisted to localStorage
 * (offline-first). Supabase sync is layered on top when configured.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import { BUILTIN_AGENTS, agentById } from "./agents";
import { KEEW_CORPUS } from "./knowledge";
import type {
  Agent, Automation, Chat, ChatMessage, Citation, KnowledgeDoc, ProviderConfig, Settings, UsageStats,
} from "./types";

export const uid = (prefix = "id") =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const DEFAULT_SETTINGS: Settings = {
  theme: "onyx",
  accentOverride: null,
  radius: "soft",
  density: "comfortable",
  font: "geist",
  backdrop: "glow",
  showAvatars: true,
  compactBubbles: false,
  sendOnEnter: true,
  streaming: true,
  showReasoning: true,
  codeWrap: false,
  soundOnDone: false,
  userNickname: "Você",
  defaultAgentId: "keew-core",
  defaultModel: "",
};

/** A Keew é a única inteligência: não há provedor externo para configurar. */
const DEFAULT_PROVIDER: ProviderConfig = {
  kind: "local",
  baseUrl: "",
  model: "keew-1",
  apiKey: "",
};

function emptyUsage(): UsageStats {
  return { messages: 0, tokensIn: 0, tokensOut: 0, byDay: {}, firstUseAt: Date.now() };
}

type StreamState = { chatId: string; messageId: string; controller: AbortController } | null;

type Actions = {
  /* chats */
  newChat: (agentId?: string) => string;
  selectChat: (id: string) => void;
  deleteChat: (id: string) => void;
  renameChat: (id: string, title: string) => void;
  togglePin: (id: string) => void;
  clearChat: (id: string) => void;
  duplicateChat: (id: string) => void;

  /* messaging */
  send: (text: string, opts?: { attachments?: ChatMessage["attachments"]; regenerateFrom?: string }) => Promise<void>;
  stop: () => void;
  editing: StreamState;
  retry: (messageId: string) => Promise<void>;

  /* agents */
  upsertAgent: (agent: Agent) => void;
  deleteAgent: (id: string) => void;
  resetAgents: () => void;

  /* knowledge */
  addKnowledge: (doc: Omit<KnowledgeDoc, "id" | "createdAt" | "updatedAt"> & { id?: string }) => void;
  deleteKnowledge: (id: string) => void;
  importKnowledge: (docs: KnowledgeDoc[]) => void;

  /* automations */
  upsertAutomation: (a: Automation) => void;
  deleteAutomation: (id: string) => void;
  toggleAutomation: (id: string) => void;
  runAutomation: (id: string) => Promise<void>;

  /* settings & system */
  setSettings: (patch: Partial<Settings>) => void;
  resetSettings: () => void;
  setProvider: (patch: Partial<ProviderConfig>) => void;
  setAccessKey: (key: string) => void;
  purgeAll: () => void;
  exportAll: () => string;
  importAll: (json: string) => boolean;
  noteUsage: (out: number, inTok?: number) => void;

  /* ui */
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  contextOpen: boolean;
  setContextOpen: (v: boolean) => void;
  settingsOpen: boolean;
  settingsTab: string;
  openSettings: (tab?: string) => void;
  closeSettings: () => void;
  commandOpen: boolean;
  setCommandOpen: (v: boolean) => void;
  toast: { id: string; message: string; tone?: "ok" | "error" | "info" } | null;
  pushToast: (message: string, tone?: "ok" | "error" | "info") => void;
  clearToast: () => void;
};

export type Store = {
  hydrated: boolean;
  chats: Chat[];
  currentChatId: string | null;
  agents: Agent[];
  knowledge: KnowledgeDoc[];
  automations: Automation[];
  settings: Settings;
  provider: ProviderConfig;
  accessKey: string;
  usage: UsageStats;
  busy: boolean;
} & Actions;

const welcome = (): Chat => ({
  id: uid("chat"),
  title: "Nova conversa",
  agentId: "keew-core",
  messages: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      hydrated: false,
      chats: [welcome()],
      currentChatId: null,
      agents: BUILTIN_AGENTS,
      knowledge: [],
      automations: [],
      settings: DEFAULT_SETTINGS,
      provider: DEFAULT_PROVIDER,
      accessKey: "",
      usage: emptyUsage(),
      busy: false,
      editing: null,
      sidebarOpen: true,
      contextOpen: false,
      settingsOpen: false,
      settingsTab: "aparencia",
      commandOpen: false,
      toast: null,

      /* ────────────────────────────────────────────────────────── chats */
      newChat: (agentId) => {
        const chosen = agentId || get().settings.defaultAgentId;
        const chat: Chat = { ...welcome(), agentId: chosen || "keew-core" };
        set((s) => ({ chats: [chat, ...s.chats], currentChatId: chat.id }));
        return chat.id;
      },

      selectChat: (id) => {
        set({ currentChatId: id });
        if (typeof window !== "undefined" && window.innerWidth < 1024) set({ sidebarOpen: false });
      },

      deleteChat: (id) =>
        set((s) => {
          const chats = s.chats.filter((c) => c.id !== id);
          const next = chats.length ? chats : [welcome()];
          return { chats: next, currentChatId: s.currentChatId === id ? next[0].id : s.currentChatId };
        }),

      renameChat: (id, title) =>
        set((s) => ({
          chats: s.chats.map((c) => (c.id === id ? { ...c, title: title.trim().slice(0, 90) || "Sem título" } : c)),
        })),

      togglePin: (id) =>
        set((s) => ({ chats: s.chats.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)) })),

      clearChat: (id) =>
        set((s) => ({
          chats: s.chats.map((c) => (c.id === id ? { ...c, messages: [], title: "Nova conversa", updatedAt: Date.now() } : c)),
        })),

      duplicateChat: (id) =>
        set((s) => {
          const src = s.chats.find((c) => c.id === id);
          if (!src) return {};
          const copy: Chat = { ...src, id: uid("chat"), title: `${src.title} (cópia)`, createdAt: Date.now(), updatedAt: Date.now() };
          return { chats: [copy, ...s.chats], currentChatId: copy.id };
        }),

      /* ─────────────────────────────────────────────────────── messaging */
      send: async (text, opts) => {
        const content = text.trim();
        if (!content || get().busy) return;
        const state = get();
        const chatId = state.currentChatId || state.chats[0]?.id;
        let chat = state.chats.find((c) => c.id === chatId);
        if (!chat) return;

        const agent = agentById(state.agents, chat.agentId);
        const userMsg: ChatMessage = {
          id: uid("m"),
          role: "user",
          content,
          attachments: opts?.attachments,
          createdAt: Date.now(),
        };
        const assistantId = uid("m");
        const assistantMsg: ChatMessage = {
          id: assistantId,
          role: "assistant",
          content: "",
          agentId: agent.id,
          createdAt: Date.now(),
          pending: true,
        };

        const title = chat.messages.length === 0
          ? (content.length > 46 ? `${content.slice(0, 46)}…` : content)
          : chat.title;

        const history: RunArgs["history"] = [...chat.messages, userMsg].map((m) => ({
          role: m.role,
          content: m.content,
          attachments: m.attachments,
        }));

        set((s) => ({
          busy: true,
          chats: s.chats.map((c) =>
            c.id === chatId
              ? { ...c, title, messages: [...c.messages, userMsg, assistantMsg], updatedAt: Date.now() }
              : c,
          ),
          currentChatId: chatId,
        }));

        await runStream({ chatId, assistantId, history, agent, system: agent.systemPrompt });
      },

      retry: async (messageId) => {
        const s = get();
        const chat = s.chats.find((c) => c.id === s.currentChatId);
        if (!chat) return;
        const idx = chat.messages.findIndex((m) => m.id === messageId);
        if (idx < 0) return;
        const before = chat.messages.slice(0, idx).filter((m) => m.role !== "system");
        const retryId = uid("m");
        set((state) => ({
          busy: true,
          chats: state.chats.map((c) =>
            c.id === chat.id
              ? {
                  ...c,
                  messages: [
                    ...c.messages.slice(0, idx),
                    { id: retryId, role: "assistant", content: "", createdAt: Date.now(), pending: true, agentId: c.agentId },
                    ...c.messages.slice(idx + 1),
                  ],
                }
              : c,
          ),
        }));
        const agent = agentById(s.agents, chat.agentId);
        await runStream({
          chatId: chat.id,
          assistantId: retryId,
          history: before.map((m) => ({ role: m.role, content: m.content, attachments: m.attachments })),
          agent,
          system: agent.systemPrompt,
        });
      },

      stop: () => {
        const editing = get().editing;
        editing?.controller.abort();
        set({ busy: false, editing: null });
      },

      /* ────────────────────────────────────────────────────────── agents */
      upsertAgent: (agent) =>
        set((s) => {
          const exists = s.agents.some((a) => a.id === agent.id);
          return { agents: exists ? s.agents.map((a) => (a.id === agent.id ? agent : a)) : [...s.agents, agent] };
        }),
      deleteAgent: (id) =>
        set((s) => ({
          agents: s.agents.filter((a) => a.id !== id || a.builtin),
          settings: { ...s.settings, defaultAgentId: s.settings.defaultAgentId === id ? "keew-core" : s.settings.defaultAgentId },
        })),
      resetAgents: () => set({ agents: BUILTIN_AGENTS }),

      /* ─────────────────────────────────────────────────────── knowledge */
      addKnowledge: (doc) =>
        set((s) => {
          const now = Date.now();
          const full: KnowledgeDoc = {
            id: doc.id || uid("k"),
            title: doc.title.slice(0, 200) || "Sem título",
            content: doc.content,
            tags: doc.tags || [],
            createdAt: now,
            updatedAt: now,
          };
          const without = s.knowledge.filter((k) => k.id !== full.id);
          return { knowledge: [full, ...without] };
        }),
      deleteKnowledge: (id) => set((s) => ({ knowledge: s.knowledge.filter((k) => k.id !== id) })),
      importKnowledge: (docs) =>
        set((s) => {
          const ids = new Set(s.knowledge.map((k) => k.id));
          return { knowledge: [...docs.filter((d) => !ids.has(d.id)), ...s.knowledge] };
        }),

      /* ───────────────────────────────────────────────────── automations */
      upsertAutomation: (a) =>
        set((s) => ({
          automations: s.automations.some((x) => x.id === a.id)
            ? s.automations.map((x) => (x.id === a.id ? a : x))
            : [a, ...s.automations],
        })),
      deleteAutomation: (id) => set((s) => ({ automations: s.automations.filter((a) => a.id !== id) })),
      toggleAutomation: (id) =>
        set((s) => ({
          automations: s.automations.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)),
        })),
      runAutomation: async (id) => {
        const a = get().automations.find((x) => x.id === id);
        if (!a) return;
        const agent = agentById(get().agents, a.agentId);
        const chat = { ...welcome(), title: `⚙︎ ${a.name}`, agentId: agent.id };
        set((s) => ({ chats: [chat, ...s.chats], currentChatId: chat.id }));
        await get().send(a.prompt);
      },

      /* ──────────────────────────────────────────────────── settings/system */
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      resetSettings: () => set({ settings: DEFAULT_SETTINGS }),
      setProvider: (patch) => set((s) => ({ provider: { ...s.provider, ...patch } })),
      setAccessKey: (key) => set({ accessKey: key.trim() }),

      purgeAll: () =>
        set({
          chats: [welcome()],
          currentChatId: null,
          knowledge: [],
          automations: [],
          usage: emptyUsage(),
          agents: BUILTIN_AGENTS,
        }),

      exportAll: () => {
        const s = get();
        return JSON.stringify(
          {
            app: "keew-ia",
            version: 1,
            exportedAt: new Date().toISOString(),
            chats: s.chats,
            agents: s.agents,
            knowledge: s.knowledge,
            automations: s.automations,
            settings: s.settings,
            usage: s.usage,
          },
          null,
          2,
        );
      },

      importAll: (raw) => {
        try {
          const data = JSON.parse(raw);
          if (!data || typeof data !== "object") return false;
          set((s) => ({
            chats: Array.isArray(data.chats) && data.chats.length ? data.chats : s.chats,
            agents: Array.isArray(data.agents) && data.agents.length ? data.agents : s.agents,
            knowledge: Array.isArray(data.knowledge) ? data.knowledge : s.knowledge,
            automations: Array.isArray(data.automations) ? data.automations : s.automations,
            settings: data.settings ? { ...DEFAULT_SETTINGS, ...data.settings } : s.settings,
            usage: data.usage ? { ...emptyUsage(), ...data.usage } : s.usage,
          }));
          return true;
        } catch {
          return false;
        }
      },

      noteUsage: (out, inTok) =>
        set((s) => {
          const day = new Date().toISOString().slice(0, 10);
          return {
            usage: {
              ...s.usage,
              messages: s.usage.messages + 1,
              tokensOut: s.usage.tokensOut + (out || 0),
              tokensIn: s.usage.tokensIn + (inTok || 0),
              byDay: { ...s.usage.byDay, [day]: (s.usage.byDay[day] || 0) + 1 },
            },
          };
        }),

      /* ────────────────────────────────────────────────────────────── ui */
      setSidebarOpen: (v) => set({ sidebarOpen: v }),
      setContextOpen: (v) => set({ contextOpen: v }),
      openSettings: (tab) => set({ settingsOpen: true, settingsTab: tab || get().settingsTab }),
      closeSettings: () => set({ settingsOpen: false }),
      setCommandOpen: (v) => set({ commandOpen: v }),
      pushToast: (message, tone = "info") => {
        set({ toast: { id: uid("t"), message, tone } });
        if (typeof window !== "undefined") {
          window.setTimeout(() => {
            if (get().toast?.message === message) set({ toast: null });
          }, 3200);
        }
      },
      clearToast: () => set({ toast: null }),
    }),
    {
      name: "keew-ia-v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        chats: s.chats,
        currentChatId: s.currentChatId,
        agents: s.agents,
        knowledge: s.knowledge,
        automations: s.automations,
        settings: s.settings,
        provider: s.provider,
        accessKey: s.accessKey,
        usage: s.usage,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.hydrated = true;
          if (!state.currentChatId && state.chats?.length) state.currentChatId = state.chats[0].id;
        }
        useStore.setState({ hydrated: true });
      },
    },
  ),
);

/* ══════════════════════════════════════════════════════════════════ stream ══ */

type RunArgs = {
  chatId: string;
  assistantId: string;
  history: { role: string; content: string; attachments?: ChatMessage["attachments"] }[];
  agent: Agent;
  system: string;
};

async function runStream({ chatId, assistantId, history, agent, system }: RunArgs) {
  const s = useStore.getState();
  const controller = new AbortController();
  useStore.setState({ editing: { chatId, messageId: assistantId, controller }, busy: true });

  const flush = (patch: Partial<ChatMessage>, append = true) => {
    useStore.setState((state) => ({
      chats: state.chats.map((c) =>
        c.id !== chatId
          ? c
          : {
              ...c,
              updatedAt: Date.now(),
              messages: c.messages.map((m) => {
                if (m.id !== assistantId) return m;
                if (!append) return { ...m, ...patch };
                return {
                  ...m,
                  content: patch.content ?? m.content,
                  reasoning: patch.reasoning ?? m.reasoning,
                };
              }),
            },
      ),
    }));
  };

  let content = "";
  let reasoning = "";
  let sources: Citation[] = [];
  let usage: { in?: number; out?: number } = {};
  let lastFlush = 0;
  let raf = 0;

  const scheduleFlush = () => {
    const now = Date.now();
    if (now - lastFlush > 45) {
      lastFlush = now;
      flush({ content, reasoning }, false);
    } else if (!raf) {
      raf = requestAnimationFrame(() => {
        raf = 0;
        lastFlush = Date.now();
        flush({ content, reasoning }, false);
      });
    }
  };

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(s.accessKey ? { "x-keew-key": s.accessKey } : {}),
      },
      signal: controller.signal,
      body: JSON.stringify({
        messages: history,
        system,
        agentId: agent.id,
        temperature: agent.temperature,
        knowledge: s.knowledge,
      }),
    });

    if (!res.ok || !res.body) {
      const detail = await res.json().catch(() => ({}));
      throw new Error(detail?.error || `Falha ${res.status} no serviço da Keew.`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const line = frame.split("\n").find((l) => l.startsWith("data:"));
        if (!line) continue;
        let data: any;
        try { data = JSON.parse(line.slice(5).trim()); } catch { continue; }
        if (data.t === "text") { content += data.v; scheduleFlush(); }
        else if (data.t === "reasoning") { reasoning += data.v; scheduleFlush(); }
        else if (data.t === "sources") { sources = Array.isArray(data.v) ? data.v : []; }
        else if (data.t === "usage") { usage = { ...usage, ...data.v }; }
        else if (data.t === "error") { content += `\n\n> ${data.v}`; scheduleFlush(); }
      }
    }

    flush(
      {
        content,
        reasoning,
        citations: sources.length ? sources : undefined,
        pending: false,
        tokens: { in: usage.in, out: usage.out },
      },
      false,
    );
    useStore.getState().noteUsage(usage.out || content.length / 4, usage.in || 0);
    if (useStore.getState().settings.soundOnDone) ding();
  } catch (err) {
    const aborted = (err as Error).name === "AbortError";
    if (aborted) {
      flush({ content: content || "_Geração interrompida._", reasoning, pending: false }, false);
    } else {
      const msg = (err as Error).message || "Erro inesperado";
      flush(
        {
          content: content || `**Não consegui concluir agora.**\n\n${msg}\n\nTente de novo em instantes — o núcleo próprio continua respondendo cálculos, datas e conversões.`,
          reasoning,
          pending: false,
          error: msg,
        },
        false,
      );
    }
  } finally {
    if (raf) cancelAnimationFrame(raf);
    useStore.setState({ busy: false, editing: null });
  }
}

function ding() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.24);
  } catch { /* audio is a nicety */ }
}

/* ─────────────────────────────────────────────────────── derived helpers */

export function useCurrentChat(): Chat | undefined {
  return useStore((s) => s.chats.find((c) => c.id === s.currentChatId) || s.chats[0]);
}

export function useHydrated(): boolean {
  return useStore((s) => s.hydrated);
}

export function allKnowledge(): KnowledgeDoc[] {
  return [...useStore.getState().knowledge, ...KEEW_CORPUS];
}
