import Link from "next/link";
import { PreGameShell } from "@/components/game/LobbyUI";
import { HudButton } from "@/components/game/HudButton";

export default function TermsPage() {
  return (
    <PreGameShell>
      <main className="max-w-2xl w-full p-6 rounded-2xl border border-white/10 bg-black/40 backdrop-blur text-gray-200 font-ui text-sm sm:text-base space-y-4">
        <h1 className="font-display text-3xl font-bold text-gold-light tracking-wide">Terms of Service</h1>
        <p>
          KOUPPI is provided for casual entertainment. Virtual chips have no real-world monetary value.
          Players must be 13 or older (or the minimum age required in their jurisdiction).
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Be respectful in chat and player names — harassment, hate speech, and spam are not allowed.</li>
          <li>Do not attempt to disrupt rooms, cheat, or abuse server rate limits.</li>
          <li>Hosts may remove players or close rooms; the service may remove rooms that violate these terms.</li>
          <li>The game is offered as-is without warranties; downtime or data loss may occur during beta.</li>
        </ul>
        <p>By playing multiplayer or creating a room, you agree to these terms and our Privacy Policy.</p>
        <div className="flex gap-3 pt-2">
          <Link href="/">
            <HudButton variant="ghost">Home</HudButton>
          </Link>
          <Link href="/privacy">
            <HudButton variant="ghost">Privacy Policy</HudButton>
          </Link>
        </div>
      </main>
    </PreGameShell>
  );
}
