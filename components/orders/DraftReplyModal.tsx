"use client";

import React, { useState, useEffect } from "react";
import { X, Copy, Check, MessageSquare, Sparkles } from "lucide-react";
import { Order } from "@/types/order";
import { Button } from "../ui/Button";
import { generateReplyDraft } from "@/lib/reply-draft";

interface DraftReplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Partial<Order> | null;
}

export const DraftReplyModal: React.FC<DraftReplyModalProps> = ({
  isOpen,
  onClose,
  order,
}) => {
  const [draftText, setDraftText] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (order) {
      setDraftText(generateReplyDraft(order));
      setCopied(false);
    }
  }, [order]);

  if (!isOpen || !order) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(draftText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-crumb-espresso/45 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-crumb-surface border border-crumb-border rounded-2xl max-w-lg w-full shadow-modal overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-crumb-border flex items-center justify-between bg-crumb-surface">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-crumb-terracotta-light text-crumb-terracotta flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-crumb-espresso">
                Draft Customer Reply
              </h2>
              <p className="text-xs text-crumb-muted">
                Deterministic reply asking for unresolved order details
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-crumb-subtle hover:text-crumb-espresso p-1.5 rounded-lg hover:bg-crumb-surface-alt transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3.5">
          <div className="flex items-center justify-between text-xs text-crumb-muted">
            <span>You can edit this message before copying:</span>
            <span className="text-[11px] text-crumb-subtle">
              Copy & paste into WhatsApp / Instagram
            </span>
          </div>

          <textarea
            rows={8}
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            className="w-full text-xs sm:text-sm p-3.5 rounded-xl bg-crumb-surface-alt/70 border border-crumb-border focus:border-crumb-terracotta focus:ring-1 focus:ring-crumb-terracotta/40 outline-none resize-none leading-relaxed text-crumb-espresso font-sans"
          />

          <div className="p-3 rounded-lg bg-crumb-surface-alt/50 border border-crumb-border/70 text-[11px] text-crumb-muted space-y-1">
            <p className="font-medium text-crumb-espresso">
              Privacy & Control Notice:
            </p>
            <p>
              CrumbDesk does not connect to external chat networks or send messages automatically. You retain full control over customer conversations.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-crumb-border bg-crumb-surface-alt/40 flex items-center justify-end gap-2.5">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleCopy}
            leftIcon={
              copied ? (
                <Check className="w-4 h-4 text-white" />
              ) : (
                <Copy className="w-4 h-4" />
              )
            }
            className={copied ? "bg-crumb-sage hover:bg-crumb-sage" : ""}
          >
            {copied ? "Copied to Clipboard!" : "Copy Reply"}
          </Button>
        </div>
      </div>
    </div>
  );
};
