"use client";

import { useEffect, useRef } from "react";
import { ArrowDown } from "lucide-react";

import { useStore } from "@/lib/store";

import { Composer } from "./composer";
import { MessageRow } from "./message";
import { Welcome } from "./welcome";
import { useState } from "react";

export function ChatView() {
  const chats = useStore((s) => s.chats);
  const currentChatId = useStore((s) => s.currentChatId);
  const backdrop = useStore((s) => s.settings.backdrop);
  const chat = chats.find((c) => c.id === currentChatId) || chats[0];
  const messages = chat?.messages || [];

  const scroller = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [stuck, setStuck] = useState(true);

  /* smart autoscroll: follow the stream unless the user scrolled up */
  useEffect(() => {
    if (stuck) bottom.current?.scrollIntoView({ block: "end" });
  }, [messages, stuck]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onScroll = () => {
      const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      setAtBottom(near);
      setStuck(near);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && useStore.getState().busy) useStore.getState().stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* themed backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {backdrop === "glow" && (
          <>
            <div
              className="absolute -top-40 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full blur-[120px]"
              style={{ background: "radial-gradient(ellipse, rgb(var(--glow) / 0.18), transparent 65%)" }}
            />
            <div
              className="absolute bottom-[-30%] right-[-10%] h-[380px] w-[520px] rounded-full blur-[130px]"
              style={{ background: "radial-gradient(ellipse, rgb(var(--glow) / 0.10), transparent 70%)" }}
            />
          </>
        )}
        {backdrop === "grid" && <div className="absolute inset-0 grid-lines opacity-60" />}
        {backdrop === "dots" && (
          <div
            className="absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage: "radial-gradient(circle, var(--line-strong) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
              maskImage: "radial-gradient(70% 60% at 50% 30%, black, transparent 85%)",
            }}
          />
        )}
        {backdrop === "noise" && <div className="noise absolute inset-0" />}
      </div>

      {/* messages */}
      <div
        ref={scroller}
        className="scroll-thin relative z-[1] min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 sm:px-5"
      >
        <div className="mx-auto w-full max-w-[760px] pb-6 pt-4">
          {messages.length === 0 ? (
            <Welcome />
          ) : (
            <div className="space-y-6">
              {messages.map((m, i) => (
                <MessageRow key={m.id} message={m} isLast={i === messages.length - 1} />
              ))}
            </div>
          )}
          <div ref={bottom} className="h-1" />
        </div>
      </div>

      {!atBottom && messages.length > 0 && (
        <button
          onClick={() => {
            setStuck(true);
            bottom.current?.scrollIntoView({ behavior: "smooth" });
          }}
          className="anim-scale absolute bottom-[132px] left-1/2 z-20 -translate-x-1/2 rounded-full border border-line bg-panel/95 p-1.5 text-muted shadow-xl backdrop-blur transition-colors hover:text-fg"
          aria-label="Ir para o fim"
        >
          <ArrowDown className="size-4" />
        </button>
      )}

      {/* composer dock */}
      <div className="relative z-[2] shrink-0 border-t border-line/70 bg-gradient-to-t from-bg via-bg to-bg/40 px-3 pb-2.5 pt-3 sm:px-5">
        <div className="mx-auto w-full max-w-[760px]">
          <Composer />
        </div>
      </div>
    </div>
  );
}
