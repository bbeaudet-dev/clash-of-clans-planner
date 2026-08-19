import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-12 text-zinc-800 dark:bg-black dark:text-zinc-200">
      <Link
        href="/"
        className="mb-6 text-sm font-medium text-sky-600 hover:underline dark:text-sky-400"
      >
        Back to planner
      </Link>
      <h1 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
        Privacy Policy
      </h1>
      <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
        Last updated: August 19, 2026
      </p>

      <section className="mt-8 space-y-4 text-sm leading-6">
        <p>
          Clash of Clans Planner is an unofficial planning tool. This policy is
          a practical starter policy for how this app handles data and should be
          reviewed before public launch.
        </p>

        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          Data We Process
        </h2>
        <p>
          When you enter a player tag, we use it to fetch public Clash of Clans
          profile data such as player name, Town Hall level, and upgrade levels.
          When you import village data JSON from the game, we process that JSON
          to calculate base progress, upgrade timing, and completion insights.
        </p>
        <p>
          If you create an account, we store your email or authentication
          identity through our auth provider, plus saved Clash accounts,
          planner settings, skipped upgrades, API snapshots, and imported
          village snapshots.
        </p>

        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          How We Use Data
        </h2>
        <p>
          We use your data to provide the planner, restore saved accounts,
          calculate progress, and keep imported snapshots available for future
          analysis. Imported village data is private by default and is not
          shared publicly by the app.
        </p>

        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          Storage And Retention
        </h2>
        <p>
          Saved account data and imported snapshots are retained until you
          delete the saved account or request removal. Temporary onboarding
          state may be stored in your browser so you do not lose a lookup or
          import while signing in.
        </p>

        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          Service Providers
        </h2>
        <p>
          The app uses Convex for backend data storage and authentication
          infrastructure, and the Clash of Clans API or API proxy for public
          player lookups. These providers process data only as needed to run the
          service.
        </p>

        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          Deletion
        </h2>
        <p>
          You can delete a saved Clash account from the account menu. Deleting a
          saved account removes its saved snapshots from the app. For broader
          deletion requests, contact the app operator with your account email
          and player tag.
        </p>
      </section>
    </main>
  );
}
