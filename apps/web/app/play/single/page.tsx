"use client";
import { useLayoutEffect } from "react";
import dynamic from "next/dynamic";
import SettingsDialog, { TableSettings } from "@/components/SettingsDialog";
import { useGameStore } from "@/store/gameStore";
import SoundControl from "@/components/SoundControl";

// Use new graphics version
const Table = dynamic(() => import("@/components/TableGraphics"), { ssr: false });

export default function Page() {
  const ready = useGameStore(s => s.ready);
  const configure = useGameStore(s => s.configureSinglePlayer);
  const resetSinglePlayer = useGameStore(s => s.resetSinglePlayer);

  // Fresh SP session on enter (before paint); clear on leave so re-entry shows SettingsDialog.
  useLayoutEffect(() => {
    resetSinglePlayer();
    return () => {
      resetSinglePlayer();
    };
  }, [resetSinglePlayer]);

  const handleStart = (s: TableSettings) => {
    configure(s);
  };

  return (
    <>
      <SettingsDialog open={!ready} onStart={handleStart} />
      <Table />
      <SoundControl />
    </>
  );
}
