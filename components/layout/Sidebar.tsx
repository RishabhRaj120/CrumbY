"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Settings,
  Sparkles,
  Wheat,
  ShieldCheck,
  HardDrive,
} from "lucide-react";
import { OllamaStatusBadge } from "../dashboard/OllamaStatusBadge";

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ className = "", onNavigate }) => {
  const pathname = usePathname();

  const navItems = [
    {
      label: "Overview",
      href: "/",
      icon: LayoutDashboard,
      active: pathname === "/",
    },
    {
      label: "Orders",
      href: "/orders",
      icon: ClipboardList,
      active: pathname === "/orders",
    },
    {
      label: "Settings & Storage",
      href: "/settings",
      icon: Settings,
      active: pathname === "/settings",
    },
  ];

  return (
    <aside
      className={`w-64 bg-crumb-surface border-r border-crumb-border flex flex-col justify-between h-screen sticky top-0 ${className}`}
    >
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-crumb-border/70">
          <Link
            href="/"
            onClick={onNavigate}
            className="flex items-center gap-2.5 group"
          >
            <div className="w-9 h-9 rounded-xl bg-crumb-terracotta text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <Wheat className="w-5 h-5 text-amber-100" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-crumb-espresso block leading-tight font-serif">
                CrumbDesk
              </span>
              <span className="text-[11px] font-medium text-crumb-terracotta block uppercase tracking-wider">
                Home Baker AI
              </span>
            </div>
          </Link>

          <div className="mt-3.5">
            <OllamaStatusBadge />
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  item.active
                    ? "bg-crumb-terracotta-light text-crumb-terracotta font-semibold"
                    : "text-crumb-muted hover:text-crumb-espresso hover:bg-crumb-surface-alt"
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    item.active ? "text-crumb-terracotta" : "text-crumb-subtle"
                  }`}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Local-First & Privacy Info Panel */}
      <div className="p-4 m-3 rounded-xl bg-crumb-surface-alt/70 border border-crumb-border text-xs space-y-2">
        <div className="flex items-center gap-1.5 font-medium text-crumb-espresso">
          <HardDrive className="w-3.5 h-3.5 text-crumb-terracotta" />
          <span>Local-First Machine</span>
        </div>
        <p className="text-crumb-muted leading-relaxed text-[11px]">
          Runs on your machine with <strong>Gemma 3 4B</strong>. No cloud AI, no token fees, no external data sharing.
        </p>
        <div className="pt-1.5 border-t border-crumb-border/60 flex items-center gap-1 text-[11px] text-crumb-sage font-medium">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Local Browser Storage</span>
        </div>
      </div>
    </aside>
  );
};
