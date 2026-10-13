"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  AlertTriangle,
  Clock,
  CheckCircle,
  FileText,
  Lightbulb,
} from "lucide-react";
import { Button } from "../ui/Button";
import { ExtractedOrderPayload } from "@/types/order";

interface ImportOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExtracted: (payload: ExtractedOrderPayload, rawMessage: string) => void;
}

const PRESET_MESSAGES = [
  {
    title: "Complete Order",
    text: "Hi, need one 1kg chocolate truffle cake for Sunday at 6 PM. Eggless please. Pickup. I have paid 1200 through GPay.",
  },
  {
    title: "Incomplete Details",
    text: "Need a cake for my birthday next week.",
  },
  {
    title: "Ambiguous Payment",
    text: "Can you make a chocolate cake for Saturday? I'll send 1000 later.",
  },
  {
    title: "Dietary & Weight",
    text: "Can I get a 500g eggless red velvet cake on Friday for pickup?",
  },
];

export const ImportOrderModal: React.FC<ImportOrderModalProps> = ({
  isOpen,
  onClose,
  onExtracted,
}) => {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Timer for inference feedback
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isLoading) {
      setElapsedSeconds(0);
      timer = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isLoading]);

  if (!isOpen) return null;

  const charCount = message.length;
  const isTooLong = charCount > 5000;
  const isEmpty = message.trim().length === 0;

  const handleExtract = async () => {
    if (isEmpty || isTooLong || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      // Pass today's date formatted as YYYY-MM-DD for relative day context
      const referenceDate = new Date().toISOString().split("T")[0];

      const res = await fetch("/api/extract-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          referenceDate,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(
          data.error ||
            "Failed to extract order information. Please verify Ollama is running."
        );
      }

      onExtracted(data.data, message.trim());
      setMessage("");
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during extraction.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-crumb-espresso/45 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-crumb-surface border border-crumb-border rounded-2xl max-w-2xl w-full shadow-modal overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-crumb-border flex items-center justify-between bg-crumb-surface">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-crumb-terracotta-light text-crumb-terracotta flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-crumb-espresso">
                Import Customer Message
              </h2>
              <p className="text-xs text-crumb-muted">
                Extract structured order details using local Gemma 3 4B
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-crumb-subtle hover:text-crumb-espresso p-1.5 rounded-lg hover:bg-crumb-surface-alt transition disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Quick Preset Buttons */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-crumb-muted mb-2">
              <Lightbulb className="w-3.5 h-3.5 text-crumb-amber" />
              <span>Or try a realistic test message:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_MESSAGES.map((preset) => (
                <button
                  key={preset.title}
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    setMessage(preset.text);
                    setError(null);
                  }}
                  className="text-xs px-2.5 py-1 rounded-md bg-crumb-surface-alt hover:bg-crumb-border/70 border border-crumb-border text-crumb-espresso transition"
                >
                  {preset.title}
                </button>
              ))}
            </div>
          </div>

          {/* Textarea Input */}
          <div className="space-y-1.5">
            <label
              htmlFor="customer-message"
              className="block text-xs font-medium text-crumb-espresso"
            >
              Customer Message (WhatsApp / Instagram / SMS)
            </label>
            <div className="relative">
              <textarea
                id="customer-message"
                rows={6}
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  if (error) setError(null);
                }}
                disabled={isLoading}
                placeholder="Paste the customer's WhatsApp or Instagram message here..."
                className={`w-full p-3.5 text-sm bg-crumb-surface rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-crumb-terracotta/30 resize-none ${
                  isTooLong
                    ? "border-red-400 focus:border-red-500"
                    : "border-crumb-border focus:border-crumb-terracotta"
                } ${isLoading ? "opacity-60 bg-crumb-surface-alt cursor-wait" : ""}`}
              />
              <div className="flex items-center justify-between text-[11px] text-crumb-subtle mt-1 px-1">
                <span>Maximum 5,000 characters</span>
                <span
                  className={
                    isTooLong
                      ? "text-red-600 font-bold"
                      : charCount > 4000
                      ? "text-amber-600"
                      : "text-crumb-subtle"
                  }
                >
                  {charCount.toLocaleString()} / 5,000
                </span>
              </div>
            </div>
          </div>

          {/* Loading Animation / State */}
          {isLoading && (
            <div className="p-4 rounded-xl bg-crumb-terracotta-light/60 border border-crumb-terracotta/20 space-y-2 animate-pulse">
              <div className="flex items-center gap-2.5 text-crumb-terracotta font-medium text-sm">
                <Clock className="w-4 h-4 animate-spin" />
                <span>Running local inference with Gemma 3 4B ({elapsedSeconds}s)...</span>
              </div>
              <p className="text-xs text-crumb-espresso-light leading-relaxed">
                Extracting items, weights, requested times, fulfillment methods, and payment details without hallucinating. On an 8 GB laptop, this usually takes 4-12 seconds.
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 space-y-1.5">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <span>Extraction Error</span>
              </div>
              <p className="leading-relaxed">{error}</p>
              <div className="mt-2 pt-2 border-t border-red-200/70 text-[11px] text-red-700">
                <strong>Troubleshooting Tip:</strong> Open PowerShell and verify Ollama is active with{" "}
                <code className="bg-red-100 px-1 py-0.5 rounded font-mono">
                  ollama run gemma3:4b
                </code>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-crumb-border bg-crumb-surface-alt/40 flex items-center justify-end gap-2.5">
          <Button
            variant="outline"
            size="md"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleExtract}
            isLoading={isLoading}
            disabled={isEmpty || isTooLong || isLoading}
            leftIcon={<Sparkles className="w-4 h-4" />}
          >
            Extract Order
          </Button>
        </div>
      </div>
    </div>
  );
};
