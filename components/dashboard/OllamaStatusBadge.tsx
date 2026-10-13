"use client";

import React, { useEffect, useState } from "react";
import { Sparkles, AlertCircle, RefreshCw } from "lucide-react";
import { OllamaStatus } from "@/lib/ai/ollama";

export const OllamaStatusBadge: React.FC = () => {
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ollama-status");
      if (res.ok) {
        const data: OllamaStatus = await res.json();
        setStatus(data);
      } else {
        setStatus({
          available: false,
          modelInstalled: false,
          modelName: "gemma3:4b",
          baseUrl: "http://127.0.0.1:11434",
          error: "Ollama not responding",
        });
      }
    } catch {
      setStatus({
        available: false,
        modelInstalled: false,
        modelName: "gemma3:4b",
        baseUrl: "http://127.0.0.1:11434",
        error: "Cannot connect to local Ollama",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
    // Re-check periodically every 45s
    const interval = setInterval(checkStatus, 45000);
    return () => clearInterval(interval);
  }, []);

  const isOnline = status?.available && status?.modelInstalled;

  return (
    <div className="flex items-center gap-2">
      <div
        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
          isOnline
            ? "bg-crumb-sage-light text-crumb-sage border-crumb-sage/30"
            : "bg-amber-50 text-amber-800 border-amber-200"
        }`}
        title={
          isOnline
            ? `Connected to local Gemma 3 4B at ${status?.baseUrl}`
            : status?.error || "Ollama offline. Run 'ollama run gemma3:4b'"
        }
      >
        <span className="relative flex h-2 w-2">
          {isOnline ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-crumb-sage opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-crumb-sage"></span>
            </>
          ) : (
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          )}
        </span>

        {isOnline ? (
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-crumb-sage" />
            <span>Gemma 3 4B Local</span>
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-amber-600" />
            <span>Ollama Offline</span>
          </span>
        )}

        <button
          onClick={checkStatus}
          disabled={loading}
          className="text-crumb-muted hover:text-crumb-espresso ml-0.5 p-0.5 rounded transition"
          title="Recheck Ollama status"
        >
          <RefreshCw className={`w-2.5 h-2.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
    </div>
  );
};
