import { Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type ShareListingButtonProps = {
  title: string;
  variant?: "outline" | "ghost" | "default";
  className?: string;
};

export function ShareListingButton({
  title,
  variant = "outline",
  className,
}: ShareListingButtonProps) {
  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Could not share listing");
    }
  };

  return (
    <Button variant={variant} className={className} onClick={handleShare}>
      <Share2 className="mr-2 h-4 w-4" />
      Share
    </Button>
  );
}
