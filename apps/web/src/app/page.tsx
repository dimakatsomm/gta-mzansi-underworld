import { PLACES, CULTURAL_TERMS, SLANG } from '@gtarp/sa-content';

/**
 * Landing page — full v1 vision site.
 *
 * GTA-first: public face for Mzansi Underworld RP. Draws players into
 * the criminal society loop before the server opens. SA-authentic tone
 * (Gomora / Yizo Yizo register), not TikTok meme tropes.
 */

const features = [
  {
    icon: '📻',
    title: 'AI Police Dispatch',
    body: `Live radio chatter generated from your crimes. Every robbery, every hijacking — a real dispatcher's voice cuts through the static with your description. No two calls sound the same.`,
  },
  {
    icon: '👁️',
    title: 'AI Witnesses',
    body: `NPCs remember what they saw. A sharp-eyed spaza owner or a frightened bystander — their statements land in the dispatch feed. Go unseen or deal with the consequences.`,
  },
  {
    icon: '🔫',
    title: 'Crime Mechanics',
    body: `Armed robbery, vehicle hijacking, drug deals — every crime publishes a typed event that ripples across the world. Rep, territory, and police heat all shift in real time.`,
  },
  {
    icon: '🚔',
    title: 'Mobile Dispatch Terminal',
    body: `Cops carry a live incident feed on their MDT. Severity-coded cards, suspect descriptions, dispatch audio replay. Play both sides — or exploit the gap between them.`,
  },
];

const sharpSlang = SLANG.find((s) => s.term === 'sharp')?.term ?? 'sharp';
const lekkerSlang = SLANG.find((s) => s.term === 'lekker')?.term ?? 'lekker';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* ── Hero ── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 text-center">
        {/* ambient glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(234,179,8,0.12),transparent)]"
        />

        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-amber-400">
          {PLACES.EGOLI} never sleeps
        </p>

        <h1 className="mb-6 text-5xl font-black leading-tight tracking-tight md:text-7xl">
          {PLACES.MZANSI}
          <br />
          <span className="text-amber-400">Underworld</span>
        </h1>

        <p className="mb-4 max-w-xl text-lg text-zinc-400">
          The first AI-powered South African criminal society simulator. Powered by FiveM + QBox.{' '}
          {CULTURAL_TERMS.AMAPIANO} in the background, iron in the boot.
        </p>

        <p className="mb-10 text-sm text-zinc-500 italic">
          &ldquo;{sharpSlang}, {lekkerSlang} — this is not your ordinary GTA server.&rdquo;
        </p>

        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-lg bg-indigo-600/50 px-8 py-3 font-semibold text-white/60"
            aria-label="Join our Discord server (coming soon)"
          >
            Join Discord — coming soon
          </button>
          <a
            href="#features"
            className="rounded-lg border border-zinc-700 px-8 py-3 font-semibold text-zinc-300 transition hover:border-amber-400 hover:text-amber-400"
          >
            See how it works
          </a>
        </div>

        <p className="mt-10 text-xs text-zinc-600">Internal playtest · Phase 1</p>
      </section>

      {/* ── Features ── */}
      <section id="features" className="mx-auto max-w-5xl px-4 py-24">
        <h2 className="mb-4 text-center text-3xl font-black md:text-4xl">
          Built for the <span className="text-amber-400">kasi</span>
        </h2>
        <p className="mb-16 text-center text-zinc-500">
          Every system deepens crime, power, money, reputation, chaos, or survival.
        </p>

        <div className="grid gap-8 sm:grid-cols-2">
          {features.map((f) => (
            <article
              key={f.title}
              className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 transition hover:border-amber-400/50"
            >
              <span className="mb-4 block text-3xl" aria-hidden="true">
                {f.icon}
              </span>
              <h3 className="mb-2 text-lg font-bold">{f.title}</h3>
              <p className="text-sm leading-relaxed text-zinc-400">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="border-t border-zinc-800 bg-zinc-900 px-4 py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-4 text-3xl font-black md:text-4xl">
            The loop that creates <span className="text-amber-400">clips</span>
          </h2>
          <p className="mb-16 text-zinc-500">Every crime triggers a chain. Play it or escape it.</p>

          <ol className="space-y-8 text-left">
            {[
              {
                step: '01',
                title: 'Crime happens',
                desc: 'You rob a spaza shop, hijack a bakkie, or make a drop. A typed event goes out across the network the moment you pull the trigger.',
              },
              {
                step: '02',
                title: 'Witnesses observe',
                desc: 'Nearby NPCs sample the scene — lighting, distance, fear. High-quality witnesses produce detailed statements. Refusing witnesses go quiet.',
              },
              {
                step: '03',
                title: 'Dispatch goes live',
                desc: "A real AI voice hits police radios within seconds. Severity sets the tone — routine mugging gets a flat read; CIT heist gets controlled panic. It's on every cop's MDT.",
              },
              {
                step: '04',
                title: 'The world reacts',
                desc: 'Reputation shifts. Territory moves. Heat builds. The criminal society responds to what you did and how cleanly you did it.',
              },
            ].map(({ step, title, desc }) => (
              <li key={step} className="flex gap-6">
                <span className="mt-1 text-2xl font-black text-amber-400 tabular-nums">{step}</span>
                <div>
                  <h3 className="mb-1 font-bold">{title}</h3>
                  <p className="text-sm text-zinc-400">{desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Discord CTA ── */}
      <section className="px-4 py-24 text-center">
        <h2 className="mb-4 text-3xl font-black md:text-4xl">Get in before the server opens</h2>
        <p className="mb-10 text-zinc-500">
          Internal playtest spots are limited. Join the Discord to be first in line.
        </p>
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-lg bg-indigo-600/50 px-10 py-4 text-lg font-semibold text-white/60"
          aria-label="Join our Discord server (coming soon)"
        >
          Join Discord — coming soon
        </button>
        <p className="mt-6 text-xs text-zinc-600">
          No spam. No dates. Just the drop when it&apos;s ready.
        </p>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-zinc-800 px-4 py-8 text-center text-xs text-zinc-600">
        <p>
          {PLACES.MZANSI} Underworld RP · Phase 1 Internal ·{' '}
          <span className="text-zinc-700">Not affiliated with Rockstar Games</span>
        </p>
      </footer>
    </main>
  );
}
