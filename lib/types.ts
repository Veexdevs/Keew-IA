/**
 * Shared domain types for the Keew IA workspace.
 */
export type Role = "user" | "assistant" | "system";

export type Attachment = {
  id: string;
  name: string;
  mime: string;
  size: number;
  /** inline text extraction for small text files */
  text?: string;
  /** data URL for images (vision-capable providers) */
  dataUrl?: string;
};

export type Citation = {
  title: string;
  url?: string;
  /** texto do trecho / explicação curta */
  snippet?: string;
  kind?: "knowledge" | "web";
};

export type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  reasoning?: string;
  agentId?: string;
  model?: string;
  attachments?: Attachment[];
  createdAt: number;
  /** streaming state */
  pending?: boolean;
  error?: string;
  citations?: Citation[];
  tokens?: { in?: number; out?: number };
};

export type Chat = {
  id: string;
  title: string;
  agentId: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  archived?: boolean;
  projectId?: string;
};

export type Agent = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  systemPrompt: string;
  temperature: number;
  model?: string;
  tools: AgentTool[];
  builtin?: boolean;
  accent?: string;
};

export type AgentTool = "reasoning" | "code" | "search" | "files" | "math" | "translate";

export type Settings = {
  theme: string;
  accentOverride: string | null;
  radius: "sharp" | "soft" | "round";
  density: "compact" | "comfortable" | "spacious";
  font: string;
  backdrop: string;
  showAvatars: boolean;
  compactBubbles: boolean;
  sendOnEnter: boolean;
  streaming: boolean;
  showReasoning: boolean;
  codeWrap: boolean;
  soundOnDone: boolean;
  userNickname: string;
  defaultAgentId: string;
  defaultModel: string;
};

/**
 * A Keew é a única inteligência exposta. Os valores herdados existem apenas
 * para que configurações antigas continuem carregando sem quebrar; nada disso
 * é selecionável na interface.
 */
export type ProviderKind = "keew" | "local" | "deepseek";

export type ProviderConfig = {
  kind: ProviderKind;
  baseUrl: string;
  model: string;
  /** never leaves the browser except to the proxy route; server env takes priority */
  apiKey?: string;
};

export type KnowledgeDoc = {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  tags?: string[];
};

export type Automation = {
  id: string;
  name: string;
  schedule: string;
  prompt: string;
  agentId: string;
  enabled: boolean;
  lastRunAt?: number;
  lastStatus?: "ok" | "error";
  lastResult?: string;
};

export type UsageStats = {
  messages: number;
  tokensIn: number;
  tokensOut: number;
  byDay: Record<string, number>;
  firstUseAt: number;
};

export type HealthStatus = {
  ok: boolean;
  provider: string;
  model: string;
  configured: boolean;
  latencyMs?: number;
  uptimeSec: number;
  version: string;
  supabase: boolean;
  automations: number;
  lastCheck?: number;
  error?: string;
};
