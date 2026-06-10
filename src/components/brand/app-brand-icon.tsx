import { cn } from "@/lib/utils";

import { CampusBazarLogo } from "@/components/brand/campusbazar-logo";

interface AppBrandIconProps {
  /**
   * Optional className for the wrapper text element.
   */
  className?: string;
  /**
   * Optional className for the icon container.
   */
  iconClassName?: string;
  /**
   * Whether to show the "CampusBazar" text beside the icon.
   * Defaults to true.
   */
  showText?: boolean;
  /**
   * Whether to render the smaller 44px mobile-sized circle.
   * @default false
   */
  compact?: boolean;
}

/**
 * Premium app-icon appearance for the CampusBazar brand.
 *
 * Backed by the shared `<CampusBazarLogo />` component:
 *  - Perfect 52px circle (44px on mobile via `compact`)
 *  - Orange gradient background
 *  - Soft drop shadow + 2px white ring
 *  - Cart icon centered with object-fit: contain (no cropping/stretching)
 *  - Optional "CampusBazar" wordmark beside the icon
 *
 * Looks similar to Notion / Discord / Figma / Slack branding.
 */
export function AppBrandIcon({
  className,
  iconClassName,
  showText = true,
  compact = false,
}: AppBrandIconProps) {
  return (
    <CampusBazarLogo
      className={className}
      iconClassName={iconClassName}
      showText={showText}
      compact={compact}
    />
  );
}

export default AppBrandIcon;
