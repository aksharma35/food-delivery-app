"use client";

import { useEffect, useRef, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const WELCOME_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "Hey there! I'm Sam from Foodly support 👋 Ask me anything about ordering, delivery, refunds, or your account — happy to help.",
};

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, isOpen, isLoading]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Something went wrong.");
      }
      setMessages([...nextMessages, { role: "assistant", content: data.reply }]);
    } catch {
      setError("Sorry, I couldn't reach support chat. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {isOpen && (
        <div className="flex h-[32rem] w-[22rem] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-3xl border border-black/5 bg-background shadow-2xl shadow-black/10 ring-1 ring-black/5">
          <div className="flex items-center gap-3 bg-brand px-5 py-4 text-white">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-lg"
              aria-hidden
            >
              🍔
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">Foodly Support</span>
              <span className="text-xs text-white/80">Answers from our policies, instantly</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
              className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/15"
            >
              ✕
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-cream/40 px-4 py-4">
            {messages.map((message, i) => (
              <div
                key={i}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    message.role === "user"
                      ? "bg-brand text-white"
                      : "bg-background text-foreground shadow-sm ring-1 ring-black/5"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl bg-background px-4 py-2.5 text-sm text-foreground/50 shadow-sm ring-1 ring-black/5">
                  Typing…
                </div>
              </div>
            )}
            {error && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl bg-red-50 px-4 py-2.5 text-sm text-red-700 ring-1 ring-red-200">
                  {error}
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-black/5 bg-background p-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about orders, refunds, delivery…"
              disabled={isLoading}
              className="flex-1 rounded-full border border-foreground/15 bg-background px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              aria-label="Send message"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              ➤
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={isOpen ? "Close support chat" : "Open support chat"}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-2xl text-white shadow-lg shadow-brand/30 transition-transform hover:-translate-y-0.5 hover:bg-brand-dark"
      >
        {isOpen ? "✕" : "💬"}
      </button>
    </div>
  );
}
