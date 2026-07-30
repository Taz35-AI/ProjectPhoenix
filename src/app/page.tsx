import Link from "next/link";

/**
 * Landing page. Sets the emotional register: calm, premium, grounded. The
 * distant figure on a path is a CSS silhouette — no copyrighted assets, and it
 * matches the "future self waiting further down the path" promise.
 */
export default function LandingPage() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="phoenix-horizon pointer-events-none absolute inset-0" aria-hidden />

      {/* Distant future-self silhouette on the path */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-1/2 h-40 w-24 -translate-x-1/2 animate-ember-glow"
        style={{
          background:
            "radial-gradient(50% 60% at 50% 40%, hsl(var(--ember-soft) / 0.5), transparent 70%)",
          maskImage:
            "radial-gradient(40% 55% at 50% 42%, black 40%, transparent 72%)",
        }}
      />

      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <span className="text-sm font-semibold tracking-widest text-ember">PHOENIX</span>
        <Link
          href="/login"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Sign in
        </Link>
      </header>

      <section className="relative z-10 mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="animate-rise text-sm uppercase tracking-[0.25em] text-muted-foreground">
          A journey, not a tracker
        </p>
        <h1 className="animate-rise mt-6 text-balance text-4xl font-semibold leading-tight sm:text-6xl">
          Become the person you promised yourself you would become.
        </h1>
        <p className="animate-rise mt-6 max-w-xl text-pretty text-lg text-muted-foreground">
          Your future self is waiting further down the path — a grounded guide,
          not a fortune teller. One honest move at a time, you close the distance.
        </p>

        <div className="animate-rise mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="rounded-full bg-ember px-8 py-3 font-medium text-ember-foreground shadow-[0_0_40px_-8px_hsl(var(--ember)/0.6)] transition-transform hover:scale-[1.02]"
          >
            Begin the journey
          </Link>
          <Link
            href="/privacy"
            className="rounded-full border border-border px-8 py-3 text-muted-foreground transition-colors hover:text-foreground"
          >
            How your data is handled
          </Link>
        </div>

        <p className="mt-8 max-w-md text-xs leading-relaxed text-muted-foreground/80">
          Future You is a simulated guide. It never claims to know your future or
          guarantees outcomes — it helps you focus on what is in your control today.
          Phoenix is not a medical or therapy service.
        </p>
      </section>

      <footer className="relative z-10 px-6 py-6 text-center text-xs text-muted-foreground/70">
        © {new Date().getFullYear()} Project Phoenix · Grounded personal transformation
      </footer>
    </main>
  );
}
