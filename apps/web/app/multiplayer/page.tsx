"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Redirect old multiplayer page to the new lobby
export default function MultiplayerPage() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace("/lobby");
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <p className="text-lg">Redirecting to lobby...</p>
    </main>
  );
}
