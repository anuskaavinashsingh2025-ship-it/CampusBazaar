const STORAGE_KEY = "campusbazar_saved_logins_v1";
const MAX_SAVED = 3;

export type SavedLogin = {
  email: string;
  displayName?: string;
  provider: "email" | "google";
  savedAt: string;
};

export function getSavedLogins(): SavedLogin[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedLogin[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLogin(entry: Omit<SavedLogin, "savedAt">) {
  const existing = getSavedLogins().filter(
    (item) => item.email.toLowerCase() !== entry.email.toLowerCase(),
  );
  const next: SavedLogin[] = [{ ...entry, savedAt: new Date().toISOString() }, ...existing].slice(
    0,
    MAX_SAVED,
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function removeSavedLogin(email: string) {
  const next = getSavedLogins().filter((item) => item.email.toLowerCase() !== email.toLowerCase());
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
