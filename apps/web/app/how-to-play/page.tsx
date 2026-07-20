import Link from "next/link";
import { PreGameShell } from "@/components/game/LobbyUI";
import { HudButton } from "@/components/game/HudButton";

export default function HowToPlay() {
  return (
    <PreGameShell>
      <main className="max-w-2xl w-full p-6 rounded-2xl border border-white/10 bg-black/40 backdrop-blur">
        <h1 className="font-display text-3xl font-bold mb-4 text-gold-light tracking-wide">
          How to Play KOUPPI
        </h1>
        <ul className="list-disc pl-6 space-y-2 text-gray-200 font-ui text-sm sm:text-base">
          <li>Standard 52-card deck (A=1, J=11, Q=12, K=13). Suits are irrelevant.</li>
          <li>Each player antes into the pot. Default ante: 10 chips.</li>
          <li>On your turn, you receive two upcards. You may Pass or Bet.</li>
          <li>
            If you Bet, a third card is drawn. If its rank is strictly between your two upcards, you
            win your bet from the pot; otherwise you lose the bet to the pot (ties are losses).
          </li>
          <li>
            KOUPPI: Bet exactly the pot (only if your bankroll ≥ pot). Win: take the whole pot. Lose:
            add your bet to the pot.
          </li>
          <li>
            SHISTRI (optional): If exactly one winning rank exists, you may place a small bet (7% of
            pot, min 1). Win: take the whole pot; else lose the bet to the pot.
          </li>
          <li>
            Equal or consecutive upcards have no winning card — you&apos;ll be warned but can still bet
            if you want to gamble.
          </li>
          <li>Round ends only when pot is 0.</li>
        </ul>
        <div className="mt-6 flex gap-3">
          <Link href="/lobby">
            <HudButton variant="success">Play Multiplayer</HudButton>
          </Link>
          <Link href="/">
            <HudButton variant="ghost">Home</HudButton>
          </Link>
        </div>
      </main>
    </PreGameShell>
  );
}
