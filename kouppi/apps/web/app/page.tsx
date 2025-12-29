import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen p-6 flex flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-bold">KOUPPI</h1>
      <p className="opacity-80 text-center max-w-lg">
        Fast, casual Cypriot card game playable on web and mobile. Single‑player MVP.
      </p>
      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-3">
          <Link href="/play/single" className="btn">Play (Single Player)</Link>
          <Link href="/how-to-play" className="btn">How to Play</Link>
        </div>
        <Link href="/lobby" className="btn bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg text-lg font-semibold">
          🎮 Multiplayer Lobby
        </Link>
      </div>
      <footer className="opacity-70 text-sm mt-10">
        For entertainment only. Chips have no monetary value.
      </footer>
    </main>
  );
}
