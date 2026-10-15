"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { api } from "@/lib/api";
import type { AmyChatSession, AmyMessage } from "@/lib/types";

// Amy tutor page redesign ported from Vue: compact flat header (ChatGPT/
// Claude-style), small circular avatar, slim control bar, flex chat area.
// Streaming: tries SSE via the BFF proxy; falls back to non-streaming POST.

interface LocalMsg extends AmyMessage {
  pending?: boolean;
}

export default function AmyChat() {
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<LocalMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // load most recent session if any
    (async () => {
      try {
        const list = await api.get<AmyChatSession[]>("/amy/sessions");
        if (list.length > 0) {
          const s = await api.get<AmyChatSession>(`/amy/sessions/${list[0].id}`);
          setSessionId(s.id);
          setMessages(s.messages ?? []);
        }
      } catch {
        /* first run — session created on first message */
      }
    })();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);

    const userMsg: LocalMsg = {
      id: Date.now(),
      session_id: sessionId ?? 0,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    const botMsg: LocalMsg = {
      id: Date.now() + 1,
      session_id: sessionId ?? 0,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
      pending: true,
    };
    setMessages((m) => [...m, userMsg, botMsg]);

    const patchBot = (content: string, done: boolean) =>
      setMessages((m) =>
        m.map((x) =>
          x.id === botMsg.id ? { ...x, content, pending: !done } : x,
        ),
      );

    try {
      // Attempt streaming through the proxy (SSE: data: {"token": "..."} )
      const res = await fetch("/api/proxy/amy/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message: text }),
      });

      if (res.ok && res.body) {
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let acc = "";
        let gotAny = false;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const line of dec.decode(value, { stream: true }).split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") continue;
            try {
              const obj = JSON.parse(payload) as {
                token?: string;
                session_id?: number;
              };
              if (obj.session_id && !sessionId) setSessionId(obj.session_id);
              if (obj.token) {
                acc += obj.token;
                gotAny = true;
                patchBot(acc, false);
              }
            } catch {
              /* ignore partial json */
            }
          }
        }
        if (gotAny) {
          patchBot(acc, true);
          return;
        }
      }

      // Fallback: non-streaming endpoint
      const reply = await api.post<{ message: AmyMessage; session_id: number }>(
        "/amy/chat",
        { session_id: sessionId, message: text },
      );
      if (!sessionId) setSessionId(reply.session_id);
      patchBot(reply.message.content, true);
    } catch {
      patchBot("⚠️ Something went wrong. Please try again.", true);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function newSession() {
    setSessionId(null);
    setMessages([]);
    inputRef.current?.focus();
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-8.5rem)] max-w-3xl mx-auto">
      {/* Compact flat header */}
      <div className="flex items-center gap-2.5 py-2 border-b border-[var(--border)]">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0"
          style={{ background: "var(--primary)" }}
        >
          🦉
        </div>
        <div className="min-w-0">
          <h1 className="font-bold text-sm leading-tight truncate">
            Amy — your AI tutor
          </h1>
          <p className="text-[11px] text-muted leading-tight">
            {busy ? "typing…" : "Bangla & English · HSC/SSC focused"}
          </p>
        </div>
        <div className="flex-1" />
        <button
          onClick={newSession}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-[var(--surface-2)] border border-[var(--border)]"
        >
          + New chat
        </button>
      </div>

      {/* Flex chat area */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-muted text-sm mt-10">
            Ask Amy anything — e.g.{" "}
            <em>&quot;Explain photosynthesis in Bangla&quot;</em> or{" "}
            <em>&quot;Help me with quadratic equations&quot;</em>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={clsx(
              "flex",
              m.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            <div
              className={clsx(
                "max-w-[85%] sm:max-w-[75%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap",
                m.role === "user" ? "text-white rounded-br-md" : "rounded-bl-md",
              )}
              style={
                m.role === "user"
                  ? { background: "var(--primary)" }
                  : {
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                    }
              }
            >
              {m.content || (m.pending ? <span className="animate-pulse">…</span> : "")}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Slim control bar */}
      <div className="flex items-center gap-2 py-2 border-t border-[var(--border)]">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Message Amy…"
          className="flex-1 rounded-xl px-4 py-2.5 text-sm bg-[var(--surface)] border border-[var(--border)] outline-none focus:border-[var(--primary)]"
        />
        <button
          onClick={send}
          disabled={busy || !input.trim()}
          className="btn-primary w-10 h-10 !p-0 rounded-xl"
          aria-label="Send"
        >
          ➤
        </button>
      </div>
    </div>
  );
}
