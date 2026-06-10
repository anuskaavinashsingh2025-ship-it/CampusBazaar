import { Heart } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import { useIsWishlisted, useWishlistToggle } from "@/lib/wishlist";
import { cn } from "@/lib/utils";

type WishlistButtonProps = {
  listingId: string;
  className?: string;
  iconClassName?: string;
  variant?: "overlay" | "inline";
};

export function WishlistButton({
  listingId,
  className,
  iconClassName,
  variant = "overlay",
}: WishlistButtonProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isWishlisted = useIsWishlisted(user?.id, listingId);
  const toggle = useWishlistToggle(user?.id);

  console.log("[WishlistButton Props]", { listingId });

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      toast.error("Please login to save items");
      navigate({ to: "/login" });
      return;
    }

    toggle.mutate({ listingId, isWishlisted });
  };

  return (
    <button
      type="button"
      aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
      aria-pressed={isWishlisted}
      disabled={toggle.isPending}
      onClick={handleClick}
      className={cn(
        variant === "overlay"
          ? "absolute right-3 top-3 grid h-9 w-9 place-content-center rounded-full bg-white/90 shadow transition-colors"
          : "inline-flex h-9 w-9 items-center justify-center rounded-full border bg-background transition-colors",
        isWishlisted ? "text-red-500" : "text-muted-foreground hover:text-red-500",
        className,
      )}
    >
      <Heart className={cn("h-5 w-5", isWishlisted && "fill-current", iconClassName)} />
    </button>
  );
}
