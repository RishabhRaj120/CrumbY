"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  HardDrive,
  Cpu,
  Trash2,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  getStoredOrders,
  loadDemoOrders,
  removeDemoOrders,
  clearAllOrders,
  ORDERS_CHANGED_EVENT,
} from "@/lib/storage/orders";
import { downloadOrdersCsv } from "@/lib/csv";
import { OllamaStatus } from "@/lib/ai/ollama";

export default function SettingsPage() {
  const [ordersCount, setOrdersCount] = useState(0);
  const [demoOrdersCount, setDemoOrdersCount] = useState(0);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [isCheckingOllama, setIsCheckingOllama] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const checkOllama = async () => {
    setIsCheckingOllama(true);
    try {
      const res = await fetch("/api/ollama-status");
      if (res.ok) {
        const data: OllamaStatus = await res.json();
        setOllamaStatus(data);
      } else {
        setOllamaStatus({
          available: false,
          modelInstalled: false,
          modelName: "gemma3:4b",
          baseUrl: "http://127.0.0.1:11434",
          error: "Ollama returned error",
        });
      }
    } catch {
      setOllamaStatus({
        available: false,
        modelInstalled: false,
        modelName: "gemma3:4b",
        baseUrl: "http://127.0.0.1:11434",
        error: "Cannot connect to Ollama",
      });
    } finally {
      setIsCheckingOllama(false);
    }
  };

  const updateCounts = () => {
    const orders = getStoredOrders();
    setOrdersCount(orders.length);
    setDemoOrdersCount(orders.filter((o) => o.is_demo).length);
  };

  useEffect(() => {
    updateCounts();
    checkOllama();
    window.addEventListener(ORDERS_CHANGED_EVENT, updateCounts);
    return () => window.removeEventListener(ORDERS_CHANGED_EVENT, updateCounts);
  }, []);

  const handleAction = (msg: string, fn: () => void) => {
    fn();
    updateCounts();
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3000);
  };

  return (
    <div>
      <Header
        title="Settings & Storage"
        subtitle="Local AI engine status, privacy disclosures, and browser storage management"
        onOpenImportModal={() => {}}
        onExportCsv={() => downloadOrdersCsv(getStoredOrders())}
        onLoadDemoData={loadDemoOrders}
        onRemoveDemoData={removeDemoOrders}
        hasDemoData={demoOrdersCount > 0}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {actionMessage && (
          <div className="p-3.5 rounded-xl bg-crumb-sage-light border border-crumb-sage/30 text-crumb-sage text-xs font-medium flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Section 1: AI Diagnostics */}
        <div className="bg-crumb-surface p-5 sm:p-6 rounded-2xl border border-crumb-border shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-crumb-terracotta-light text-crumb-terracotta flex items-center justify-center">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-crumb-espresso">
                  Local AI Inference Engine
                </h2>
                <p className="text-xs text-crumb-muted">
                  Powered by Ollama and Gemma 3 4B on your local machine
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={checkOllama}
              isLoading={isCheckingOllama}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Test Connection
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-3.5 rounded-xl bg-crumb-surface-alt/70 border border-crumb-border space-y-1">
              <span className="text-[11px] text-crumb-subtle block uppercase font-medium">
                Model Name
              </span>
              <span className="font-mono text-xs font-semibold text-crumb-espresso">
                {ollamaStatus?.modelName || "gemma3:4b"}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-crumb-surface-alt/70 border border-crumb-border space-y-1">
              <span className="text-[11px] text-crumb-subtle block uppercase font-medium">
                Local Endpoint
              </span>
              <span className="font-mono text-xs font-semibold text-crumb-espresso">
                {ollamaStatus?.baseUrl || "http://127.0.0.1:11434"}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-crumb-surface-alt/70 border border-crumb-border space-y-1">
              <span className="text-[11px] text-crumb-subtle block uppercase font-medium">
                Engine Status
              </span>
              <div className="flex items-center gap-1.5 pt-0.5">
                {ollamaStatus?.available && ollamaStatus?.modelInstalled ? (
                  <Badge variant="success" dot size="sm">
                    Connected & Ready
                  </Badge>
                ) : (
                  <Badge variant="warning" dot size="sm">
                    Offline or Model Missing
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-crumb-surface-alt/50 border border-crumb-border text-xs text-crumb-espresso space-y-1.5">
            <div className="flex items-center gap-2 font-medium">
              <Info className="w-3.5 h-3.5 text-crumb-terracotta" />
              <span>Ollama Quick Commands</span>
            </div>
            <p className="text-[11px] text-crumb-muted">
              Start Ollama in your terminal:{" "}
              <code className="bg-crumb-surface px-1.5 py-0.5 rounded border border-crumb-border font-mono">
                ollama run gemma3:4b
              </code>
            </p>
          </div>
        </div>

        {/* Section 2: Browser Storage Management */}
        <div className="bg-crumb-surface p-5 sm:p-6 rounded-2xl border border-crumb-border shadow-sm space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-crumb-sage-light text-crumb-sage flex items-center justify-center">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-crumb-espresso">
                Browser Storage Management
              </h2>
              <p className="text-xs text-crumb-muted">
                Inspect and manage local order records persisted in your browser
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-xl bg-crumb-surface-alt/70 border border-crumb-border">
              <span className="text-[11px] text-crumb-subtle block uppercase font-medium">
                Total Stored Records
              </span>
              <span className="text-xl font-bold text-crumb-espresso mt-1 block">
                {ordersCount} orders
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-crumb-surface-alt/70 border border-crumb-border">
              <span className="text-[11px] text-crumb-subtle block uppercase font-medium">
                Demo Sample Records
              </span>
              <span className="text-xl font-bold text-crumb-espresso mt-1 block">
                {demoOrdersCount} demo records
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                handleAction("Loaded 4 sample demo orders.", loadDemoOrders)
              }
              leftIcon={<Sparkles className="w-3.5 h-3.5 text-crumb-amber" />}
            >
              Load Demo Records
            </Button>

            {demoOrdersCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  handleAction("Cleared all demo orders.", removeDemoOrders)
                }
                leftIcon={<Trash2 className="w-3.5 h-3.5 text-crumb-subtle" />}
              >
                Clear Demo Records Only
              </Button>
            )}

            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (
                  window.confirm(
                    "Are you sure you want to clear all stored orders? This cannot be undone."
                  )
                ) {
                  handleAction("Cleared all order records.", clearAllOrders);
                }
              }}
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            >
              Reset All Storage
            </Button>
          </div>
        </div>

        {/* Section 3: Privacy & Security Disclosures */}
        <div className="bg-crumb-surface p-5 sm:p-6 rounded-2xl border border-crumb-border shadow-sm space-y-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-crumb-surface-alt text-crumb-espresso flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-crumb-sage" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-crumb-espresso">
                Privacy & Security Model
              </h2>
              <p className="text-xs text-crumb-muted">
                Transparent information regarding local execution and data handling
              </p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs text-crumb-muted leading-relaxed">
            <div className="p-3 rounded-xl bg-crumb-surface-alt/50 border border-crumb-border">
              <strong className="text-crumb-espresso block mb-0.5">
                1. 100% Local Model Execution
              </strong>
              Customer messages are sent directly from the Next.js local backend to your local Ollama port. No customer message ever leaves your machine, and no third-party cloud API keys are used.
            </div>

            <div className="p-3 rounded-xl bg-crumb-surface-alt/50 border border-crumb-border">
              <strong className="text-crumb-espresso block mb-0.5">
                2. Browser LocalStorage Limitation
              </strong>
              Orders in this MVP are stored in your browser&apos;s localStorage. Note that browser localStorage is unencrypted. Do not store sensitive bank account credentials or credit card numbers.
            </div>

            <div className="p-3 rounded-xl bg-crumb-surface-alt/50 border border-crumb-border">
              <strong className="text-crumb-espresso block mb-0.5">
                3. Customer-Reported vs Verified Payments
              </strong>
              CrumbDesk intentionally tags payments as &quot;customer_reported_paid&quot;. It does not connect to banking APIs or verify UPI balances. Always verify funds inside your actual payment app before baking.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
