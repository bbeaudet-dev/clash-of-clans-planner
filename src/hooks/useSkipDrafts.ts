"use client";

import { useEffect, useState } from "react";
import { setSkipCount } from "@/lib/skipModel";

const SKIP_DRAFT_PREFIX = "coc-planner:skip-draft:";

function sameStringArray(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function readSkipDraft(key: string): string[] | null {
  try {
    const raw = localStorage.getItem(`${SKIP_DRAFT_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { draft?: unknown };
    return Array.isArray(parsed.draft) &&
      parsed.draft.every((v) => typeof v === "string")
      ? parsed.draft
      : null;
  } catch {
    return null;
  }
}

export function useSkipDrafts({
  skips,
  draftKey,
  onCommit,
}: {
  skips: string[];
  draftKey: string;
  onCommit: (skips: string[]) => void;
}) {
  const [draftSkips, setDraftSkips] = useState<string[] | null>(null);
  const [draftBase, setDraftBase] = useState<string[]>([]);
  const [skipMode, setSkipMode] = useState(false);

  const activeSkips = skipMode && draftSkips ? draftSkips : skips;
  const dirty = draftSkips !== null && !sameStringArray(draftSkips, draftBase);

  function clearDraft(key = draftKey) {
    if (typeof window !== "undefined") {
      localStorage.removeItem(`${SKIP_DRAFT_PREFIX}${key}`);
    }
    setDraftSkips(null);
    setDraftBase([]);
  }

  function enter() {
    const recovered =
      typeof window === "undefined" ? null : readSkipDraft(draftKey);
    setDraftBase(skips);
    setDraftSkips(recovered ?? skips);
    setSkipMode(true);
  }

  function save() {
    const nextSkips = draftSkips ?? skips;
    onCommit(nextSkips);
    clearDraft();
    setSkipMode(false);
  }

  function discard() {
    clearDraft();
    setSkipMode(false);
  }

  function setCount(key: string, nextCount: number, maxCount: number) {
    const baseSkips = skipMode ? (draftSkips ?? skips) : skips;
    const nextSkips = setSkipCount(baseSkips, key, nextCount, maxCount);
    if (skipMode) {
      setDraftSkips(nextSkips);
    } else {
      onCommit(nextSkips);
    }
  }

  useEffect(() => {
    if (!skipMode || draftSkips === null) return;
    localStorage.setItem(
      `${SKIP_DRAFT_PREFIX}${draftKey}`,
      JSON.stringify({ base: draftBase, draft: draftSkips })
    );
  }, [draftBase, draftKey, draftSkips, skipMode]);

  return {
    activeSkips,
    clearDraft,
    dirty,
    discard,
    enter,
    save,
    setCount,
    setSkipMode,
    skipMode,
  };
}
