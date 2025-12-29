export default function HowToPlay() {
  return (
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4">How to Play KOUPPI</h1>
      <ul className="list-disc pl-6 space-y-2">
        <li>Standard 52-card deck (A=1, J=11, Q=12, K=13). Suits are irrelevant.</li>
        <li>Each player antes into the pot. Default ante: 10 chips.</li>
        <li>On your turn, you receive two upcards. You may Pass or Bet.</li>
        <li>If you Bet, a third card is drawn. If its rank is strictly between your two upcards, you win your bet from the pot; otherwise you lose the bet to the pot (ties are losses).</li>
        <li>KOUPPI: Bet exactly the pot (only if your bankroll ≥ pot). Win: take the whole pot. Lose: add your bet to the pot.</li>
        <li>SHISTRI (optional): If exactly one winning rank exists, you may place a small bet (5% of pot, min 1). Win: take the whole pot; else lose the bet to the pot.</li>
        <li>Equal or consecutive upcards have no winning card - you'll be warned but can still bet if you want to gamble.</li>
        <li>Round ends only when pot is 0.</li>
      </ul>
    </main>
  );
}
