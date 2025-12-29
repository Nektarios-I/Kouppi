"use client";
import dynamic from "next/dynamic";
import SettingsDialog, { TableSettings } from "@/components/SettingsDialog";
import { useGameStore } from "@/store/gameStore";

const Table = dynamic(() => import("@/components/Table"), { ssr: false });

export default function Page() {
  const ready = useGameStore(s => s.ready);
  const configure = useGameStore(s => s.configureSinglePlayer);

  const handleStart = (s: TableSettings) => {
    configure(s);
  };

  return (
    <>
      <SettingsDialog open={!ready} onStart={handleStart} />
      <Table />
    </>
  );
}
