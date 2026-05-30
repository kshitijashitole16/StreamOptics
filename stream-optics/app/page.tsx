import Link from "next/link"

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#060a13] px-4 py-10 text-zinc-100 md:px-8">
      <section className="w-full max-w-5xl overflow-hidden rounded-2xl border border-cyan-300/20 bg-[radial-gradient(circle_at_top,rgba(20,78,132,0.45),rgba(5,10,22,0.92)_48%,rgba(3,5,12,0.96))] shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
        <header className="flex items-center justify-between border-b border-cyan-200/20 px-5 py-3 font-mono text-xs tracking-[0.25em] text-cyan-100/80">
          <span>STREAMOPTICS.CONSOLE</span>
          <span className="text-emerald-300">READY</span>
        </header>

        <div className="grid gap-8 px-6 py-8 md:grid-cols-[1.2fr_1fr] md:px-10 md:py-10">
          <div className="space-y-5">
            <p className="font-mono text-xs uppercase tracking-[0.32em] text-cyan-200/70">
              Media QoS Control Plane
            </p>
            <h1 className="max-w-xl text-3xl font-semibold leading-tight text-zinc-50 md:text-4xl">
              Stream delivery diagnostics with live playback intelligence
            </h1>
            <p className="max-w-xl text-sm leading-7 text-zinc-300/90 md:text-base">
              Launch the adaptive player to create sessions, then inspect buffered depth,
              stall behavior, bitrate evolution, and startup performance in the analytics hub.
            </p>
          </div>

          <div className="flex flex-col gap-4 rounded-xl border border-cyan-300/20 bg-black/35 p-4 backdrop-blur-sm">
            <Link
              href="/player"
              className="group rounded-lg border border-cyan-300/40 bg-cyan-500/10 px-4 py-4 text-left transition hover:border-cyan-200/70 hover:bg-cyan-400/20"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-cyan-100/70">
                Route /player
              </p>
              <p className="mt-1 text-lg font-semibold text-zinc-100">Launch Stream Player</p>
            </Link>

            <Link
              href="/dashboard"
              className="group rounded-lg border border-violet-300/35 bg-violet-500/10 px-4 py-4 text-left transition hover:border-violet-200/70 hover:bg-violet-400/20"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-violet-100/70">
                Route /dashboard
              </p>
              <p className="mt-1 text-lg font-semibold text-zinc-100">
                Open QoS Analytics Hub
              </p>
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
