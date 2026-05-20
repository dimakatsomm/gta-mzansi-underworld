import { CULTURAL_TERMS, PLACES } from '@gtarp/sa-content';

/**
 * Landing page — hero block + Discord invite placeholder.
 *
 * GTA-first: scaffolds the server's public face so players can find the
 * Discord and join the criminal society before the server opens.
 */
export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Hero */}
      <section className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-amber-400">
          {PLACES.EGOLI} never sleeps
        </p>

        <h1 className="mb-6 text-5xl font-black leading-tight tracking-tight md:text-7xl">
          {PLACES.MZANSI}
          <br />
          <span className="text-amber-400">Underworld</span>
        </h1>

        <p className="mb-10 max-w-xl text-lg text-zinc-400">
          The first AI-powered South African criminal society simulator. Powered by FiveM + QBox.{' '}
          {CULTURAL_TERMS.AMAPIANO} in the background, iron in the boot.
        </p>

        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-lg bg-indigo-600/60 px-8 py-3 font-semibold text-white/70"
          aria-label="Join our Discord server (coming soon)"
        >
          Join Discord
        </button>

        <p className="mt-6 text-xs text-zinc-600">Discord invite · coming soon</p>
      </section>
    </main>
  );
}
