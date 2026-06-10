import { useNavigate } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  Bike,
  BookOpen,
  FileText,
  Laptop,
  MoreHorizontal,
  Shirt,
  Sofa,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

export const BROWSE_CATEGORIES: Array<{
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
  to?: string;
}> = [
  {
    key: "Food",
    label: "Food",
    icon: UtensilsCrossed,
    color: "bg-orange-100 text-orange-600",
    to: "/food",
  },
  { key: "Rent", label: "Rent", icon: Bike, color: "bg-blue-100 text-blue-600", to: "/rent" },
  { key: "Notes", label: "Notes", icon: FileText, color: "bg-sky-100 text-sky-600", to: "/notes" },
  {
    key: "Books",
    label: "Books",
    icon: BookOpen,
    color: "bg-amber-100 text-amber-700",
    to: "/marketplace",
  },
  {
    key: "Electronics",
    label: "Electronics",
    icon: Laptop,
    color: "bg-indigo-100 text-indigo-600",
    to: "/marketplace",
  },
  {
    key: "Furniture",
    label: "Furniture",
    icon: Sofa,
    color: "bg-stone-100 text-stone-600",
    to: "/marketplace",
  },
  {
    key: "Clothes",
    label: "Clothes",
    icon: Shirt,
    color: "bg-pink-100 text-pink-600",
    to: "/marketplace",
  },
  {
    key: "Other",
    label: "More",
    icon: MoreHorizontal,
    color: "bg-gray-100 text-gray-600",
    to: "/marketplace",
  },
];

type CategoryStripProps = {
  className?: string;
  onViewAll?: () => void;
  onCategorySelect?: (key: string) => void;
  activeKey?: string | null;
};

export function CategoryStrip({
  className,
  onViewAll,
  onCategorySelect,
  activeKey,
}: CategoryStripProps) {
  const navigate = useNavigate();
  const handleSelect = (key?: string) => {
    if (onCategorySelect && key) onCategorySelect(key);
  };

  const handleClick = (cat: (typeof BROWSE_CATEGORIES)[number]) => {
    // Notify parent about selection (for homepage filtering)
    handleSelect(cat.key);

    if (cat.to) {
      // If navigating to the marketplace, include the category as a search param so the
      // marketplace page can show a filtered view.
      if (cat.to === "/marketplace") {
        // navigate supports a search object; cast as never to match existing code patterns
        // and avoid typing noise.
        void navigate({ to: "/marketplace", search: { category: cat.key } as never });
        return;
      }
      navigate({ to: cat.to });
      return;
    }
    toast.message(`${cat.label} is coming soon`, {
      description: "This category will be available in a future update.",
    });
  };

  return (
    <div className={cn("flex gap-3 overflow-x-auto pb-2", className)}>
      {BROWSE_CATEGORIES.map((cat) => (
        <button
          key={cat.key}
          type="button"
          onClick={() => handleClick(cat)}
          className={cn(
            "min-w-[80px] shrink-0 rounded-xl border px-3 py-3 text-center text-xs shadow-sm transition-shadow hover:shadow-md",
            activeKey === cat.key
              ? "border-primary bg-primary/10 text-primary"
              : "bg-card text-muted-foreground",
          )}
        >
          <div
            className={cn(
              "mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl",
              cat.color,
            )}
          >
            <cat.icon className="h-5 w-5" />
          </div>
          <div className="font-medium">{cat.label}</div>
        </button>
      ))}
      {onViewAll && (
        <button
          type="button"
          onClick={onViewAll}
          className="min-w-[80px] shrink-0 self-center text-xs font-medium text-primary hover:underline"
        >
          View all
        </button>
      )}
    </div>
  );
}
