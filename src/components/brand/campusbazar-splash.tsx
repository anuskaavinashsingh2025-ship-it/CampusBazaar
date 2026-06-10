import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { CampusBazarLogo } from "@/components/brand/campusbazar-logo";

/**
 * Full-page branded splash / loading screen.
 *
 * - Centered on screen
 * - Premium circular logo on top
 * - Wordmark + tagline
 * - Subtle spinner below
 * - Looks identical on mobile and desktop
 */
export interface CampusBazarSplashScreenProps {
  className?: string;
  /**
   * Optional message to display below the spinner.
   * @default "Loading…"
   */
  message?: string;
  /**
   * Whether to show the small spinner at the bottom.
   * @default true
   */
  showSpinner?: boolean;
}

export function CampusBazarSplashScreen({
  className,
  message = "Loading…",
  showSpinner = true,
}: CampusBazarSplashScreenProps) {
  return (
    <div
      className={cn(
        "flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-secondary via-background to-accent/40 px-4",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-6 text-center">
        <CampusBazarLogo size="xl" />
        <div className="space-y-1">
          <div className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            CampusBazar
          </div>
          <div className="text-sm text-muted-foreground">
            The VIT Student Marketplace
          </div>
        </div>
        {showSpinner && (
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{message}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default CampusBazarSplashScreen;
