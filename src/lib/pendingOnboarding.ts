import type { ApiPlayer } from "@/lib/gameData";

const PENDING_ONBOARDING_KEY = "coc-planner:pending-onboarding";

export interface PendingOnboardingPayload {
  tag: string;
  player: ApiPlayer | null;
  apiUpdatedAt: number | null;
  importText: string;
  builderCount: number;
  goldPass: boolean;
  savedAt: number;
}

export function writePendingOnboarding(payload: PendingOnboardingPayload) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PENDING_ONBOARDING_KEY, JSON.stringify(payload));
}

export function readPendingOnboarding(): PendingOnboardingPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PENDING_ONBOARDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingOnboardingPayload>;
    if (typeof parsed.tag !== "string") return null;
    return {
      tag: parsed.tag,
      player: (parsed.player as ApiPlayer | null) ?? null,
      apiUpdatedAt:
        typeof parsed.apiUpdatedAt === "number" ? parsed.apiUpdatedAt : null,
      importText: typeof parsed.importText === "string" ? parsed.importText : "",
      builderCount:
        typeof parsed.builderCount === "number" ? parsed.builderCount : 5,
      goldPass: Boolean(parsed.goldPass),
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function clearPendingOnboarding() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PENDING_ONBOARDING_KEY);
}
