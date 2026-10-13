"use client";

import React, { useState } from "react";
import { Plus, Download, Menu, X, Sparkles, Trash2 } from "lucide-react";
import { Button } from "../ui/Button";
import { Sidebar } from "./Sidebar";

interface HeaderProps {
  title: string;
  subtitle?: string;
  onOpenImportModal: () => void;
  onExportCsv: () => void;
  onLoadDemoData: () => void;
  onRemoveDemoData: () => void;
  hasDemoData?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  onOpenImportModal,
  onExportCsv,
  onLoadDemoData,
  onRemoveDemoData,
  hasDemoData,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <header className="bg-crumb-surface border-b border-crumb-border sticky top-0 z-20">
        <div className="px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-crumb-muted hover:text-crumb-espresso hover:bg-crumb-surface-alt transition"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-crumb-espresso font-serif">
                {title}
              </h1>
              {subtitle && (
                <p className="text-xs text-crumb-muted hidden sm:block">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Demo Data Quick Buttons */}
            {!hasDemoData ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onLoadDemoData}
                leftIcon={<Sparkles className="w-3.5 h-3.5 text-crumb-amber" />}
                title="Load sample bakery orders to test features"
                className="hidden md:inline-flex text-xs"
              >
                Load Demo Data
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRemoveDemoData}
                leftIcon={<Trash2 className="w-3.5 h-3.5 text-crumb-subtle" />}
                title="Remove only demo sample orders"
                className="hidden md:inline-flex text-xs"
              >
                Clear Demo Data
              </Button>
            )}

            {/* CSV Export Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={onExportCsv}
              leftIcon={<Download className="w-4 h-4 text-crumb-muted" />}
              className="hidden sm:inline-flex"
              title="Download orders as crumbdesk-orders.csv"
            >
              Export CSV
            </Button>

            {/* Main Primary CTA */}
            <Button
              variant="primary"
              size="md"
              onClick={onOpenImportModal}
              leftIcon={<Plus className="w-4 h-4" />}
              className="shadow-sm"
            >
              Import Order
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-crumb-espresso/40 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative flex-1 max-w-xs w-full bg-crumb-surface shadow-xl flex flex-col z-10">
            <div className="absolute top-3 right-3">
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg text-crumb-muted hover:text-crumb-espresso"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <Sidebar onNavigate={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
};
