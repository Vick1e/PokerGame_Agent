function chooseGtoBaselineAction(snapshot) {
  const legal = snapshot.legalActions;
  const strength = estimatePreSolverStrength(snapshot);

  if (legal.canCheck) {
    if (legal.canBetRaise && strength >= 0.72) {
      return { type: "betRaise", amount: legal.minTarget, source: "gto-baseline" };
    }
    return { type: "check", source: "gto-baseline" };
  }

  if (legal.callAmount <= snapshot.stack * Math.max(0.08, strength * 0.18)) {
    return { type: "call", source: "gto-baseline" };
  }

  if (legal.canAllIn && strength >= 0.82) {
    return { type: "allIn", source: "gto-baseline" };
  }

  return { type: legal.canFold ? "fold" : "call", source: "gto-baseline" };
}

function estimatePreSolverStrength(snapshot) {
  const [a, b] = snapshot.holeCards || [];
  if (!a || !b) return 0.35;
  const highCard = Math.max(a.value, b.value);
  const pair = a.value === b.value ? 0.28 : 0;
  const suited = a.suit === b.suit ? 0.05 : 0;
  const connected = Math.abs(a.value - b.value) <= 1 ? 0.04 : 0;
  const boardPressure = snapshot.communityCards.length >= 3 ? 0.08 : 0;
  return Math.min(0.96, highCard / 20 + pair + suited + connected + boardPressure);
}

if (typeof module !== "undefined") {
  module.exports = { chooseGtoBaselineAction, estimatePreSolverStrength };
}
