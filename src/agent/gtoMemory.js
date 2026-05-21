const GTO_BASE_MEMORY = {
  solverStyle: [
    "Use EV, equity, frequencies, and mixed actions as the baseline decision language.",
    "Think range-vs-range first, then map the exact hand into that range.",
    "Respect blockers and unblockers when choosing bluffs, calls, and value raises.",
    "Use pot odds, stack-to-pot ratio, position, and action history before choosing a size.",
    "Prefer a small, stable sizing tree: 25%, 33%, 50%, 75%, 100% pot, and all-in.",
    "Never use hidden opponent hole cards. Only use visible state and summarized action memory.",
  ],
  sizingPlan: [
    { label: "quarter-pot", fraction: 0.25, use: "range bet, thin pressure, cheap equity realization" },
    { label: "third-pot", fraction: 0.33, use: "standard small c-bet and broad range pressure" },
    { label: "half-pot", fraction: 0.5, use: "balanced value/protection with medium pressure" },
    { label: "three-quarter-pot", fraction: 0.75, use: "polarized value/bluff pressure" },
    { label: "pot", fraction: 1, use: "strong polarization, draw denial, low SPR pressure" },
  ],
  streetFocus: {
    preflop: "Position, stack depth, open/3-bet pressure, hand class, and blind defense.",
    flop: "Range advantage, nut advantage, board texture, equity realization, and c-bet frequency.",
    turn: "Equity shift, blockers, barrel candidates, protection needs, and SPR.",
    river: "Polarization, blockers/unblockers, pot odds, MDF pressure, and showdown value.",
  },
};

function buildGtoMemory(snapshot) {
  return {
    ...GTO_BASE_MEMORY,
    currentStreetFocus: GTO_BASE_MEMORY.streetFocus[snapshot.stage] || "Use legal actions and maximize EV.",
    currentPotGeometry: {
      pot: snapshot.pot,
      callAmount: snapshot.legalActions?.callAmount || 0,
      minTarget: snapshot.legalActions?.minTarget || 0,
      maxTarget: snapshot.legalActions?.maxTarget || 0,
      spr: snapshot.stack && snapshot.pot ? Number((snapshot.stack / Math.max(1, snapshot.pot)).toFixed(2)) : null,
    },
  };
}

if (typeof module !== "undefined") {
  module.exports = { GTO_BASE_MEMORY, buildGtoMemory };
}
