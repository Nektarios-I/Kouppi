import Link from "next/link";
import { PreGameShell } from "@/components/game/LobbyUI";
import { HudButton } from "@/components/game/HudButton";

export default function PrivacyPage() {
  return (
    <PreGameShell>
      <main className="max-w-2xl w-full p-6 rounded-2xl border border-white/10 bg-black/40 backdrop-blur text-gray-200 font-ui text-sm sm:text-base space-y-4">
        <h1 className="font-display text-3xl font-bold text-gold-light tracking-wide">Privacy Policy</h1>
        <p>
          KOUPPI stores gameplay session data (room codes, player display names, chat messages) in memory on
          the game server while a room is active. Career mode accounts use a separate database for profiles
          and match history.
        </p>
        <p>
          We do not sell personal data. Chat and room activity are not retained after a room closes. If you
          use Career mode, your username and game stats are stored until you delete your account (when that
          feature is available).
        </p>
        <p>
          Contact the project maintainer for data questions or removal requests related to Career accounts.
        </p>
        <div className="flex gap-3 pt-2">
          <Link href="/">
            <HudButton variant="ghost">Home</HudButton>
          </Link>
          <Link href="/terms">
            <HudButton variant="ghost">Terms of Service</HudButton>
          </Link>
        </div>
      </main>
    </PreGameShell>
  );
}
