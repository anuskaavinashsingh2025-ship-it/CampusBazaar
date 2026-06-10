import { useNavigate } from "@tanstack/react-router";
import { Bike, FileText, Home, UtensilsCrossed } from "lucide-react";

import { cn } from "@/lib/utils";

const HUB_LINKS = [
  { key: "home", label: "Home", to: "/", icon: Home },
  { key: "rent", label: "Rent", to: "/rent", icon: Bike },
  { key: "food", label: "Food Hub", to: "/food", icon: UtensilsCrossed },
  { key: "notes", label: "Notes", to: "/notes", icon: FileText },
] as const;

type HubKey = (typeof HUB_LINKS)[number]["key"];

export function HubNavStrip({ active, className }: { active?: HubKey; className?: string }) {
  const navigate = useNavigate();

  return (
    <nav className={cn("flex gap-2 overflow-x-auto pb-1", className)} aria-label="Marketplace hubs">
      {HUB_LINKS.map((link) => (
        <button
          key={link.key}
          type="button"
          onClick={() => navigate({ to: link.to })}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            active === link.key
              ? "border-primary bg-primary/10 text-primary"
              : "bg-card text-muted-foreground hover:bg-muted/60",
          )}
        >
          <link.icon className="h-3.5 w-3.5" />
          {link.label}
        </button>
      ))}
    </nav>
  );
}
