import type { WishlistItemType } from "@/lib/wishlist";

export type RecentlyViewedItem = {
  itemType: WishlistItemType;
  itemId: string;
  title: string;
  coverUrl: string | null;
  priceLabel: string;
  route: string;
  viewedAt: string;
};

const STORAGE_KEY = "campusbazar_recently_viewed";
const MAX_ITEMS = 12;

export function getRecentlyViewed(): RecentlyViewedItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentlyViewedItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordRecentlyViewed(item: Omit<RecentlyViewedItem, "viewedAt">) {
  if (typeof window === "undefined") return;
  const entry: RecentlyViewedItem = { ...item, viewedAt: new Date().toISOString() };
  const existing = getRecentlyViewed().filter(
    (r) => !(r.itemType === entry.itemType && r.itemId === entry.itemId),
  );
  const next = [entry, ...existing].slice(0, MAX_ITEMS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
