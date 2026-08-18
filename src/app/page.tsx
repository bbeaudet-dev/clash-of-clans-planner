"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ApiPlayer, buildVillageStats } from "@/lib/gameData";
import { VillageStatsView } from "@/components/VillageStats";

const DEFAULT_TAG = "#Q8JJJ2UP";

export default function Home() {
  const fetchPlayer = useAction(api.players.fetchPlayer);
  const [tag, setTag] = useState(DEFAULT_TAG);
  const [player, setPlayer] = useState<ApiPlayer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = (await fetchPlayer({ tag })) as ApiPlayer;
      setPlayer(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPlayer(null);
    } finally {
      setLoading(false);
    }
  }

  const stats = player ? buildVillageStats(player) : null;

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-4 py-12 dark:bg-black">
      <main className="w-full max-w-3xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Clash of Clans Planner
          </h1>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            Enter a player tag to see your village upgrade status.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="mb-10 flex gap-2">
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="#PLAYERTAG"
            spellCheck={false}
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 font-mono text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <button
            type="submit"
            disabled={loading || tag.trim().length === 0}
            className="rounded-lg bg-zinc-900 px-5 py-2.5 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {loading ? "Loading…" : "Look up"}
          </button>
        </form>

        {error && (
          <div className="mb-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        {stats && player && (
          <VillageStatsView playerName={player.name} stats={stats} />
        )}

        {!stats && !error && !loading && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Try the default tag above, or paste your own.
          </p>
        )}
      </main>
    </div>
  );
}
