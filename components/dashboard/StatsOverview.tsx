import React from "react";
import { DashboardStats } from "@/types/order";
import { Clock, CheckCircle2, CalendarDays, ShoppingBag } from "lucide-react";

interface StatsOverviewProps {
  stats: DashboardStats;
  onFilterClick?: (filterType: "all" | "needs_review" | "confirmed" | "upcoming") => void;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({
  stats,
  onFilterClick,
}) => {
  const cards = [
    {
      label: "Total Orders",
      value: stats.totalOrders,
      icon: ShoppingBag,
      color: "text-crumb-espresso",
      bgColor: "bg-crumb-surface-alt",
      borderColor: "border-crumb-border",
      filter: "all" as const,
      description: "Active local order records",
    },
    {
      label: "Needs Review",
      value: stats.needsReview,
      icon: Clock,
      color: "text-crumb-amber",
      bgColor: "bg-crumb-amber-light",
      borderColor: "border-crumb-amber/30",
      filter: "needs_review" as const,
      description: "Require baker review or details",
    },
    {
      label: "Confirmed Orders",
      value: stats.confirmed,
      icon: CheckCircle2,
      color: "text-crumb-sage",
      bgColor: "bg-crumb-sage-light",
      borderColor: "border-crumb-sage/30",
      filter: "confirmed" as const,
      description: "Reviewed and accepted",
    },
    {
      label: "Upcoming Fulfillments",
      value: stats.upcomingFulfillments,
      icon: CalendarDays,
      color: "text-crumb-terracotta",
      bgColor: "bg-crumb-terracotta-light",
      borderColor: "border-crumb-terracotta/30",
      filter: "upcoming" as const,
      description: "Scheduled pickup or delivery",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            onClick={() => onFilterClick && onFilterClick(card.filter)}
            className={`p-4 sm:p-5 rounded-xl bg-crumb-surface border border-crumb-border shadow-sm hover:border-crumb-terracotta/40 transition-all cursor-pointer group`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-medium text-crumb-muted group-hover:text-crumb-espresso transition">
                {card.label}
              </span>
              <div
                className={`w-8 h-8 rounded-lg ${card.bgColor} ${card.color} flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105`}
              >
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-crumb-espresso">
                {card.value}
              </span>
            </div>
            <p className="mt-1 text-xs text-crumb-subtle line-clamp-1">
              {card.description}
            </p>
          </div>
        );
      })}
    </div>
  );
};
