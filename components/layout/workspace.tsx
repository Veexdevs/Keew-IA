"use client";

import { useEffect } from "react";

import { Mark } from "@/components/ui/mark";
import { useStore } from "@/lib/store";

import { CommandPalette } from "./command-palette";
import { ContextPanel } from "./context-panel";
import { PwaRegister } from "./pwa";
import { SettingsDialog } from "@/components/settings/settings-dialog";
import { ChatView } from "@/components/chat/chat-view";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function Workspace() {
  const hydrated = useStore((s) => s.hydrated);
  const setCommandOpen = useStore((s) => s.setCommandOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);

  /* ensure there is always an active chat + sensible mobile default */
  useEffect(() => {
    if (!hydrated) return;
    const s = useStore.getState();
    if (!s.currentChatId && s.chats.length) useStore.setState({ currentChatId: s.chats[0].id });
    if (!s.chats.length) s.newChat();
    if (window.innerWidth < 1024) useStore.setState({ sidebarOpen: false, contextOpen: false });
  }, [hydrated]);

  /* global shortcuts */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const typing = Boolean((e.target as HTMLElement)?.closest?.("input,textarea,[contenteditable]"));
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
      if (mod && e.key.toLowerCase() === "j") {
        e.preventDefault();
        useStore.getState().newChat();
      }
      if (mod && (e.key === "\\" || e.key.toLowerCase() === "b")) {
        e.preventDefault();
        setSidebarOpen(!useStore.getState().sidebarOpen);
      }
      if (mod && e.key === ",") {
        e.preventDefault();
        useStore.getState().openSettings();
      }
      if (e.key === "?" && !typing) setCommandOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCommandOpen, setSidebarOpen]);

  // Render the shell only after rehydration: keeps SSR output deterministic and
  // avoids flashes of another user's cached conversation.
  if (!hydrated) return <Splash />;

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-bg text-fg">
      <Sidebar />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <Topbar />
        <div className="relative flex min-h-0 flex-1">
          <ChatView />
          <ContextPanel />
        </div>
      </div>
      <PwaRegister />
      <CommandPalette />
      <SettingsDialog />
    </div>
  );
}

function Splash() {
  return (
    <div className="grid h-[100dvh] w-full place-items-center bg-bg">
      <div className="flex flex-col items-center gap-3">
        <span className="grid size-11 place-items-center rounded-[13px] border border-accent-line bg-accent/10 text-accent">
          <Mark size={22} />
        </span>
        <span className="shimmer h-1 w-24 rounded-full" />
        <p className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-subtle">carregando workspace</p>
      </div>
    </div>
  );
}
