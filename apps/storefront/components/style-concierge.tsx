"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { sendConciergeMessage } from "@/lib/resale";

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  content: string;
  recommended_products?: Array<{
    id: string;
    title: string;
    handle: string;
    thumbnail: string | null;
    brand: string;
  }>;
}

export function StyleConcierge() {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionToken, setSessionToken] = useState("");
  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  const [inputMessage, setInputMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "intro-1",
      sender: "assistant",
      content:
        "Welcome to The Hidden Label. I am Aura-7, your personal footwear stylist. Whether you're curating a daily rotation, searching for a specific silhouette, or pairing sneakers with an outfit, ask me anything.",
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let token = localStorage.getItem("thl_concierge_session");
    if (!token) {
      token = "sess_" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem("thl_concierge_session", token);
    }
    setSessionToken(token);
  }, []);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSend = async (e?: React.FormEvent, presetText?: string) => {
    if (e) e.preventDefault();
    const text = (presetText || inputMessage).trim();
    if (!text || isSending) return;

    const userMsg: ChatMessage = {
      id: "msg-" + Date.now(),
      sender: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    setIsSending(true);

    const res = await sendConciergeMessage({
      message: text,
      session_token: sessionToken,
      thread_id: threadId,
    });

    setIsSending(false);

    if (res) {
      if (res.thread_id) setThreadId(res.thread_id);
      const assistantMsg: ChatMessage = {
        id: "msg-" + Date.now() + "-reply",
        sender: "assistant",
        content: res.reply,
        recommended_products: res.recommended_products,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } else {
      setMessages((prev) => [
        ...prev,
        {
          id: "msg-err-" + Date.now(),
          sender: "assistant",
          content: "I encountered a network hiccup while searching the vault. Please try again.",
        },
      ]);
    }
  };

  const quickPrompts = [
    "Clean white sneaker for light denim",
    "Running sneaker with high arch comfort",
    "Retro basketball icon under ₹40,000",
  ];

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center justify-center gap-2 rounded-full border border-ink bg-ink p-3 text-surface shadow-2xl transition-transform hover:scale-105 active:scale-95 sm:bottom-6 sm:right-6 sm:px-4 sm:py-3"
        aria-label="Open Aura-7 Style Concierge"
      >
        <span className="flex h-2.5 w-2.5 items-center justify-center">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
        </span>
        <span className="hidden font-mono text-xs uppercase tracking-wider font-semibold sm:inline">
          Aura-7 Concierge (AI-05)
        </span>
        <span className="font-mono text-xs font-bold uppercase sm:hidden">
          A7
        </span>
      </button>

      {/* Slide-over Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex h-full w-full max-w-md flex-col border-l border-line bg-surface shadow-2xl animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-line p-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <div>
                  <h3 className="font-mono text-label-caps uppercase text-ink font-semibold">
                    Aura-7 Style Concierge
                  </h3>
                  <span className="font-mono text-[10px] text-muted">
                    Grounded Catalog Stylist &amp; Sourcing Engine
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="font-mono text-sm text-muted hover:text-ink px-2 py-1"
              >
                ✕
              </button>
            </div>

            {/* Conversation Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${
                    m.sender === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <span className="font-mono text-[10px] uppercase text-muted mb-1">
                    {m.sender === "user" ? "You" : "Aura-7 Stylist"}
                  </span>
                  <div
                    className={`max-w-[88%] p-3.5 text-xs font-sans leading-relaxed ${
                      m.sender === "user"
                        ? "bg-ink text-surface"
                        : "border border-line bg-surface-container/60 text-ink"
                    }`}
                  >
                    {m.content}
                  </div>

                  {/* Embedded Recommended Catalog Items */}
                  {m.recommended_products && m.recommended_products.length > 0 && (
                    <div className="mt-3 w-full space-y-2">
                      <span className="font-mono text-[10px] uppercase text-muted block">
                        Recommended Vault Silhouettes:
                      </span>
                      <div className="grid grid-cols-1 gap-2">
                        {m.recommended_products.map((item) => (
                          <Link
                            key={item.id}
                            href={`/products/${item.handle}`}
                            onClick={() => setIsOpen(false)}
                            className="flex items-center gap-3 border border-line bg-surface p-2.5 hover:border-ink transition-colors no-underline group"
                          >
                            <div className="h-12 w-12 flex-shrink-0 bg-surface-container overflow-hidden">
                              {item.thumbnail ? (
                                <img
                                  src={item.thumbnail}
                                  alt={item.title}
                                  className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                                />
                              ) : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="block font-mono text-[9px] uppercase text-muted truncate">
                                {item.brand}
                              </span>
                              <span className="block font-display text-xs uppercase text-ink truncate group-hover:underline">
                                {item.title}
                              </span>
                            </div>
                            <span className="font-mono text-[10px] uppercase text-muted group-hover:text-ink">
                              View →
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isSending && (
                <div className="flex items-center gap-2 font-mono text-xs text-muted">
                  <span className="inline-block h-2 w-2 rounded-full bg-ink animate-bounce" />
                  <span>Aura-7 is searching vault silhouettes...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompts */}
            <div className="border-t border-line px-4 py-2 bg-surface-container/20">
              <span className="font-mono text-[10px] uppercase text-muted block mb-1">
                Suggested questions:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {quickPrompts.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleSend(undefined, p)}
                    className="border border-line bg-surface px-2 py-0.5 font-mono text-[10px] text-muted hover:border-ink hover:text-ink transition-colors text-left"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Message Input Bar */}
            <form onSubmit={handleSend} className="border-t border-line p-3 flex gap-2">
              <input
                type="text"
                placeholder="Ask Aura-7 about styling, sizing, or pairs..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                className="flex-1 border border-line bg-surface px-3 py-2 font-sans text-xs text-ink focus:border-ink focus:outline-none"
              />
              <button
                type="submit"
                disabled={isSending || !inputMessage.trim()}
                className="border border-ink bg-ink px-4 py-2 font-mono text-xs uppercase text-surface hover:opacity-90 disabled:opacity-50"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
