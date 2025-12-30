import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen p-6 flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-gray-900 to-gray-950 text-white">
      <h1 className="text-5xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
        KOUPPI
      </h1>
      <p className="opacity-80 text-center max-w-lg">
        Fast, casual Cypriot card game playable on web and mobile.
      </p>
      <div className="flex flex-col items-center gap-4 mt-4">
        {/* Career Mode - Main CTA */}
        <Link 
          href="/career" 
          className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl text-xl font-bold shadow-lg shadow-indigo-900/50 transition-all transform hover:scale-105"
        >
          🏆 Career Mode
        </Link>
        
        <div className="flex gap-3 mt-2">
          <Link href="/play/single" className="btn px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
            🤖 Single Player
          </Link>
          <Link href="/lobby" className="btn px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg transition-colors">
            🎮 Multiplayer
          </Link>
          <Link href="/how-to-play" className="btn px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
            📖 How to Play
          </Link>
        </div>
      </div>
      <footer className="opacity-50 text-sm mt-10">
        For entertainment only. Chips have no monetary value.
      </footer>
    </main>
  );
}
