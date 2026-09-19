import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="max-w-xl">
        <div className="text-xs uppercase tracking-[0.3em] text-gold">Live Cricket Auction</div>
        <h1 className="font-display text-5xl sm:text-6xl mt-3 leading-[1.05]">Auction Night</h1>
        <p className="mt-4 text-ink-muted text-lg">
          Ten franchises. One purse each. Your friends in the room. Run a real IPL-style
          mega auction from your phones — no spreadsheets, no shouting over each other.
        </p>

        <div className="mt-10 grid sm:grid-cols-2 gap-4">
          <Link
            href="/create"
            className="rounded-xl border border-gold bg-gold text-void font-display text-lg py-4 hover:bg-gold-soft transition-colors"
          >
            Host an Auction
          </Link>
          <Link
            href="/join"
            className="rounded-xl border border-line bg-panel font-display text-lg py-4 hover:border-gold transition-colors"
          >
            Join with a Code
          </Link>
        </div>
      </div>
    </main>
  );
}
