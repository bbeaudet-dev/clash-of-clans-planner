import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-12 text-zinc-800 dark:bg-black dark:text-zinc-200">
      <Link
        href="/"
        className="mb-6 text-sm font-medium text-sky-600 hover:underline dark:text-sky-400"
      >
        Back to planner
      </Link>
      <h1 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
        Terms
      </h1>
      <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
        Last updated: August 19, 2026
      </p>

      <section className="mt-8 space-y-4 text-sm leading-6">
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          Unofficial Fan Tool
        </h2>
        <p>
          This material is unofficial and is not endorsed by Supercell. For more
          information, see Supercell&apos;s Fan Content Policy at supercell.com.
          Clash of Clans and related marks are trademarks of Supercell.
        </p>

        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          Planner Accuracy
        </h2>
        <p>
          Clash of Clans Planner is provided for informational planning only.
          Upgrade times, costs, availability, and calculations may be incomplete
          or inaccurate, especially after game updates or stale imports.
        </p>

        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          Your Data
        </h2>
        <p>
          You are responsible for the player tags and village data JSON you
          provide. Only import data for accounts you are allowed to manage. Do
          not use the app to sell, trade, boost, or transfer Clash of Clans
          accounts.
        </p>

        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          Availability
        </h2>
        <p>
          The app may change, stop working, or become unavailable at any time.
          Continued use of the planner means you accept these terms and the
          Privacy Policy.
        </p>
      </section>
    </main>
  );
}
