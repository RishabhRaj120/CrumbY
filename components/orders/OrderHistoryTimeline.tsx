import React from "react";
import {
  Sparkles,
  CheckCircle2,
  Flame,
  Check,
  Award,
  XCircle,
  Clock,
  AlertTriangle,
  FileEdit,
  ArrowRight,
} from "lucide-react";
import { OrderHistoryEvent } from "@/types/order";
import { formatDateTime } from "@/lib/utils";

interface OrderHistoryTimelineProps {
  events: OrderHistoryEvent[];
}

export const OrderHistoryTimeline: React.FC<OrderHistoryTimelineProps> = ({
  events = [],
}) => {
  if (!events || events.length === 0) {
    return (
      <div className="p-4 rounded-xl bg-crumb-surface-alt/50 border border-crumb-border text-center text-xs text-crumb-muted">
        No recorded history events yet.
      </div>
    );
  }

  // Sort newest first
  const sorted = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const getEventIcon = (type: string) => {
    switch (type) {
      case "order_created":
        return <Sparkles className="w-3.5 h-3.5 text-crumb-terracotta" />;
      case "order_confirmed":
        return <CheckCircle2 className="w-3.5 h-3.5 text-crumb-sage" />;
      case "preparation_started":
        return <Flame className="w-3.5 h-3.5 text-orange-600" />;
      case "order_ready":
        return <Check className="w-3.5 h-3.5 text-emerald-600" />;
      case "order_completed":
        return <Award className="w-3.5 h-3.5 text-purple-600" />;
      case "order_cancelled":
        return <XCircle className="w-3.5 h-3.5 text-rose-600" />;
      case "change_requested":
        return <Clock className="w-3.5 h-3.5 text-amber-600" />;
      case "change_approved":
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
      case "change_rejected":
        return <XCircle className="w-3.5 h-3.5 text-rose-600" />;
      case "exception_approved":
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />;
      case "baker_note_updated":
      default:
        return <FileEdit className="w-3.5 h-3.5 text-crumb-muted" />;
    }
  };

  const getEventBadgeStyle = (type: string) => {
    switch (type) {
      case "order_confirmed":
      case "change_approved":
        return "bg-crumb-sage-light text-crumb-sage border-crumb-sage/30";
      case "preparation_started":
        return "bg-orange-50 text-orange-700 border-orange-200";
      case "order_ready":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "order_completed":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "order_cancelled":
      case "change_rejected":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "change_requested":
      case "exception_approved":
        return "bg-amber-50 text-amber-800 border-amber-300";
      case "order_created":
      default:
        return "bg-crumb-surface-alt text-crumb-espresso border-crumb-border";
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-crumb-terracotta">
          Order Change & Lifecycle History
        </h4>
        <span className="text-[11px] text-crumb-subtle">
          {events.length} event(s) recorded locally
        </span>
      </div>

      <div className="relative pl-5 border-l-2 border-crumb-border/80 space-y-4">
        {sorted.map((event) => (
          <div key={event.id} className="relative group">
            {/* Timeline dot */}
            <div className="absolute -left-[27px] top-1.5 w-6 h-6 rounded-full bg-crumb-surface border border-crumb-border flex items-center justify-center shadow-xs">
              {getEventIcon(event.type)}
            </div>

            <div className="p-3 rounded-xl bg-crumb-surface border border-crumb-border text-xs space-y-1.5 shadow-xs">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span
                  className={`px-2 py-0.5 rounded-md border text-[10px] font-semibold uppercase tracking-wider ${getEventBadgeStyle(
                    event.type
                  )}`}
                >
                  {event.type.replace(/_/g, " ")}
                </span>
                <span className="text-[11px] text-crumb-subtle font-mono">
                  {formatDateTime(event.timestamp)}
                </span>
              </div>

              <p className="text-crumb-espresso font-medium leading-relaxed">
                {event.summary}
              </p>

              {event.reason && (
                <div className="p-2 rounded-lg bg-crumb-surface-alt/70 border border-crumb-border/60 text-[11px] text-crumb-espresso-light italic">
                  &ldquo;{event.reason}&rdquo;
                </div>
              )}

              {/* Field Diffs */}
              {event.field_changes && event.field_changes.length > 0 && (
                <div className="pt-1.5 mt-1 border-t border-crumb-border/50 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-crumb-muted block">
                    Field Modifications:
                  </span>
                  <div className="grid grid-cols-1 gap-1">
                    {event.field_changes.map((diff, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 text-[11px] font-mono bg-crumb-surface-alt/40 px-2 py-1 rounded border border-crumb-border/40"
                      >
                        <span className="font-semibold text-crumb-espresso font-sans">
                          {diff.field_label || diff.field}:
                        </span>
                        <span className="line-through text-crumb-subtle">
                          {String(diff.old_value ?? "—")}
                        </span>
                        <ArrowRight className="w-3 h-3 text-crumb-terracotta flex-shrink-0" />
                        <span className="font-semibold text-emerald-700">
                          {String(diff.new_value ?? "—")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
