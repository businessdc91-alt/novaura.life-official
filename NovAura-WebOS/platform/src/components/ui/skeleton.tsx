import React from "react";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  variant?: "default" | "circle" | "text";
}

interface SkeletonCardProps {
  className?: string;
}

interface SkeletonGridProps {
  count?: number;
  className?: string;
}

interface SkeletonListProps {
  count?: number;
  className?: string;
}

interface SkeletonPageProps {
  className?: string;
  hasSidebar?: boolean;
}

// ============================================================================
// Base Skeleton Component
// ============================================================================

/**
 * Base skeleton element with pulse animation
 * @param className - Additional CSS classes
 * @param variant - Visual variant (default, circle, text)
 */
export function Skeleton({
  className,
  variant = "default",
  ...props
}: SkeletonProps) {
  const variantStyles = {
    default: "rounded-md",
    circle: "rounded-full",
    text: "rounded-sm",
  };

  return (
    <div
      className={cn(
        "animate-pulse bg-white/5",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}

// ============================================================================
// Skeleton Card Component
// ============================================================================

/**
 * Card-shaped skeleton for asset cards
 * Includes: image placeholder, title, description, and price/button area
 */
export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/5 bg-white/[0.02] p-4",
        className
      )}
    >
      {/* Image placeholder */}
      <Skeleton className="aspect-video w-full rounded-lg" />

      {/* Title line */}
      <div className="mt-4 space-y-3">
        <Skeleton className="h-5 w-3/4" variant="text" />

        {/* Description lines */}
        <div className="space-y-2">
          <Skeleton className="h-3 w-full" variant="text" />
          <Skeleton className="h-3 w-2/3" variant="text" />
        </div>
      </div>

      {/* Price + button area */}
      <div className="mt-4 flex items-center justify-between">
        <Skeleton className="h-6 w-20" variant="text" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
    </div>
  );
}

// ============================================================================
// Skeleton Grid Component
// ============================================================================

/**
 * Grid of skeleton cards
 * @param count - Number of skeleton cards to display (default: 6)
 */
export function SkeletonGrid({ count = 6, className }: SkeletonGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
        className
      )}
    >
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}

// ============================================================================
// Skeleton List Component
// ============================================================================

/**
 * List view skeleton with rows containing image and text
 * @param count - Number of list rows to display (default: 5)
 */
export function SkeletonList({ count = 5, className }: SkeletonListProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4"
        >
          {/* Image thumbnail */}
          <Skeleton className="h-16 w-16 flex-shrink-0 rounded-lg" />

          {/* Text content */}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" variant="text" />
            <Skeleton className="h-3 w-1/2" variant="text" />
          </div>

          {/* Action area */}
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Skeleton Page Component
// ============================================================================

/**
 * Full page skeleton layout
 * @param hasSidebar - Whether to include a sidebar placeholder
 */
export function SkeletonPage({
  className,
  hasSidebar = false,
}: SkeletonPageProps) {
  return (
    <div className={cn("min-h-screen", className)}>
      {/* Header area */}
      <header className="border-b border-white/5 bg-white/[0.02]">
        <div className="flex h-16 items-center justify-between px-6">
          {/* Logo area */}
          <Skeleton className="h-8 w-32" variant="text" />

          {/* Nav items */}
          <div className="hidden items-center gap-6 md:flex">
            <Skeleton className="h-4 w-16" variant="text" />
            <Skeleton className="h-4 w-16" variant="text" />
            <Skeleton className="h-4 w-16" variant="text" />
          </div>

          {/* User/CTA area */}
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </header>

      {/* Main content area */}
      <div className="flex">
        {/* Optional sidebar */}
        {hasSidebar && (
          <aside className="hidden w-64 flex-shrink-0 border-r border-white/5 bg-white/[0.02] p-4 lg:block">
            <div className="space-y-4">
              <Skeleton className="h-4 w-full" variant="text" />
              <Skeleton className="h-4 w-3/4" variant="text" />
              <Skeleton className="h-4 w-full" variant="text" />
              <Skeleton className="h-4 w-2/3" variant="text" />
              <div className="my-4 border-t border-white/5" />
              <Skeleton className="h-4 w-full" variant="text" />
              <Skeleton className="h-4 w-3/4" variant="text" />
            </div>
          </aside>
        )}

        {/* Content grid */}
        <main className="flex-1 p-6">
          {/* Page title */}
          <div className="mb-8">
            <Skeleton className="mb-3 h-8 w-48" variant="text" />
            <Skeleton className="h-4 w-96" variant="text" />
          </div>

          {/* Filter/Toolbar area */}
          <div className="mb-6 flex items-center gap-4">
            <Skeleton className="h-10 w-32 rounded-lg" />
            <Skeleton className="h-10 w-32 rounded-lg" />
            <div className="flex-1" />
            <Skeleton className="h-10 w-10 rounded-lg" variant="circle" />
          </div>

          {/* Grid content */}
          <SkeletonGrid count={6} />
        </main>
      </div>
    </div>
  );
}

// ============================================================================
// Additional Utility Skeletons
// ============================================================================

/**
 * Simple text block skeleton for paragraphs
 */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn(
            "h-4",
            index === lines - 1 && lines > 1 ? "w-2/3" : "w-full"
          )}
          variant="text"
        />
      ))}
    </div>
  );
}

/**
 * Avatar skeleton with optional text lines
 */
export function SkeletonAvatar({
  size = "md",
  showText = false,
  className,
}: {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}) {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-16 w-16",
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Skeleton className={cn(sizeClasses[size])} variant="circle" />
      {showText && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" variant="text" />
          <Skeleton className="h-3 w-16" variant="text" />
        </div>
      )}
    </div>
  );
}

/**
 * Table row skeleton
 */
export function SkeletonTableRow({
  columns = 4,
  className,
}: {
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-4 p-4", className)}>
      {Array.from({ length: columns }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn("h-4", index === 0 ? "flex-1" : "w-24")}
          variant="text"
        />
      ))}
    </div>
  );
}
