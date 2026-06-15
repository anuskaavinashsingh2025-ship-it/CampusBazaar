import { cn } from "@/lib/utils";

/**
 * CampusBazar premium circular app icon.
 *
 * Outer circle (rounded-full):
 *   - Orange gradient (from orange-400 → orange-600)
 *   - Soft drop shadow (shadow-lg)
 *   - 2px white ring (ring-2 ring-white)
 *   - Perfectly circular, centered
 *
 * Inner image (the cart icon in /images/logo.jpeg):
 *   - object-contain (never crop, never stretch)
 *   - Centered both vertically and horizontally
 *   - Sized to ~70% of the circle (so it never touches the edges)
 *   - Internal padding prevents the cart icon from clipping
 *
 * Sizes:
 *   - Desktop / default: 52px × 52px
 *   - Mobile: 44px × 44px (when `compact` is true)
 *
 * Visual reference:
 *
 *   <CampusBazarLogo />                 // 52px circular logo
 *   <CampusBazarLogo compact />         // 44px circular logo
 *   <CampusBazarLogo showText />        // [Logo] CampusBazar
 */

export type CampusBazarLogoSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface CampusBazarLogoProps {
  /**
   * Optional className for the outer wrapper element.
   */
  className?: string;

  /**
   * Optional className for the circular icon container.
   */
  iconClassName?: string;

  /**
   * Whether to render the smaller 44px mobile-sized circle.
   * @default false
   */
  compact?: boolean;

  /**
   * Whether to display the "CampusBazar" wordmark next to the icon.
   * Useful for branded layout: [ Circular Logo ] CampusBazar
   * @default false
   */
  showText?: boolean;

  /**
   * Predefined size variants. Overrides `compact`.
   * - xs: 32px
   * - sm: 40px
   * - md: 52px (desktop default)
   * - lg: 72px
   * - xl: 96px
   */
  size?: CampusBazarLogoSize;

  /**
   * Optional alt text override.
   * @default "CampusBazar"
   */
  alt?: string;
}

// Map of size → outer circle (h/w) and inner image (h/w) in Tailwind classes
// The inner image is intentionally ~62–70% of the outer circle to keep
// the cart icon fully visible and never touch the circle edges.
const SIZE_MAP: Record<
  CampusBazarLogoSize,
  { container: string; image: string; font: string }
> = {
  xs: {
    container: "h-8 w-8",
    image: "h-5 w-5",
    font: "text-sm",
  },
  sm: {
    container: "h-10 w-10",
    image: "h-6 w-6",
    font: "text-base",
  },
  md: {
    container: "h-[52px] w-[52px]",
    image: "h-[36px] w-[36px]",
    font: "text-base sm:text-lg",
  },
  lg: {
    container: "h-[72px] w-[72px]",
    image: "h-12 w-12",
    font: "text-lg sm:text-xl",
  },
  xl: {
    container: "h-24 w-24",
    image: "h-16 w-16",
    font: "text-xl sm:text-2xl",
  },
};

export function CampusBazarLogo({
  className,
  iconClassName,
  compact = false,
  showText = false,
  size,
  alt = "CampusBazar",
}: CampusBazarLogoProps) {
  // Determine the active size: explicit `size` wins, else `compact ? "sm" : "md"`.
  // Default to 52px desktop / 44px mobile as per the spec.
  const activeSize: CampusBazarLogoSize =
    size ?? (compact ? "sm" : "md");

  const { container, image, font } = SIZE_MAP[activeSize];

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span
        aria-hidden={showText ? "false" : "true"}
        role={showText ? "img" : undefined}
        aria-label={showText ? alt : undefined}
        className={cn(
          // Perfect circle
          "inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden",
          // Orange gradient background
          "bg-gradient-to-br from-orange-400 to-orange-600",
          // Soft drop shadow
          "shadow-lg",
          // 2px white border / ring
          "ring-2 ring-white",
          // Size
          container,
          iconClassName,
        )}
      >
        <img
          src="/images/logo.jpeg"
          alt={showText ? "" : alt}
          draggable={false}
          // object-contain keeps the cart icon fully visible.
          // No cropping, no stretching, preserves aspect ratio.
          className={cn(
  "select-none object-cover scale-[1.8] pointer-events-none",
  image,
)}
        />
      </span>
      {showText && (
        <span
          className={cn(
            "font-bold tracking-tight text-foreground whitespace-nowrap",
            font,
          )}
        >
          CampusBazar
        </span>
      )}
    </div>
  );
}

/**
 * Standalone circular icon – just the logo, no wrapper flex layout.
 * Useful for tight spaces (favicons, square slots, status bar, etc.).
 */
export function CampusBazarIcon({
  className,
  size = "md",
  alt = "CampusBazar",
}: Pick<CampusBazarLogoProps, "className" | "size" | "alt">) {
  const { container, image } = SIZE_MAP[size];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden",
        "bg-gradient-to-br from-orange-400 to-orange-600",
        "shadow-lg ring-2 ring-white",
        container,
        className,
      )}
      aria-label={alt}
      role="img"
    >
      <img
        src="/images/logo.jpeg"
        alt=""
        draggable={false}
        className={cn("select-none object-cover scale-[1.8] pointer-events-none", image)}
      />
    </span>
  );
}

/**
 * Full splash-screen brand mark: large circular icon + wordmark + tagline.
 * Used for splash / loading screens.
 */
export function CampusBazarSplash({
  className,
  tagline = "The VIT Student Marketplace",
}: {
  className?: string;
  tagline?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 text-center",
        className,
      )}
    >
      <CampusBazarLogo size="xl" />
      <div className="space-y-1">
        <div className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          CampusBazar
        </div>
        <div className="text-sm text-muted-foreground">{tagline}</div>
      </div>
    </div>
  );
}

export default CampusBazarLogo;
