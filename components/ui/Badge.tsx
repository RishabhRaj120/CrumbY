import React from "react";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "neutral" | "success" | "warning" | "danger" | "terracotta" | "demo";
  size?: "sm" | "md";
  dot?: boolean;
  className?: string;
  title?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "neutral",
  size = "md",
  dot = false,
  className = "",
  title,
}) => {
  const sizeStyles = {
    sm: "px-2 py-0.5 text-xs font-medium gap-1",
    md: "px-2.5 py-1 text-xs font-medium gap-1.5",
  };

  const variantStyles = {
    neutral: "bg-crumb-surface-alt text-crumb-muted border border-crumb-border",
    success: "bg-crumb-sage-light text-crumb-sage border border-crumb-sage/30",
    warning: "bg-crumb-amber-light text-crumb-amber border border-crumb-amber/30",
    danger: "bg-red-50 text-red-700 border border-red-200",
    terracotta:
      "bg-crumb-terracotta-light text-crumb-terracotta border border-crumb-terracotta/30",
    demo: "bg-purple-50 text-purple-700 border border-purple-200 font-semibold tracking-wider uppercase text-[10px]",
  };

  const dotColors = {
    neutral: "bg-crumb-subtle",
    success: "bg-crumb-sage",
    warning: "bg-crumb-amber",
    danger: "bg-red-500",
    terracotta: "bg-crumb-terracotta",
    demo: "bg-purple-500",
  };

  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full border ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]} flex-shrink-0`}
        />
      )}
      <span>{children}</span>
    </span>
  );
};
