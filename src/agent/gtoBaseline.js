function chooseGtoBaselineAction(snapshot) {
  const options = scoreGtoOptions(snapshot);
  const recommended = options[0] || { type: "check", score: 0, reason: "No legal GTO option available." };
  return {
    type: recommended.type,
    amount: recommended.amount,
    source: "gto-baseline",
    confidence: recommended.score,
    reason: recommended.reason,
    gtoOptions: options,
  };
}

function scoreGtoOptions(snapshot) {
  const legal = snapshot.legalActions;
  const strength = estimatePreSolverStrength(snapshot);
  const pressure = legal.toCall && snapshot.stack ? Math.min(1, legal.toCall / Math.max(1, snapshot.stack)) : 0;
  const options = [];

  if (legal.canCheck) {
    options.push({
      type: "check",
      score: roundScore(0.64 - strength * 0.18),
      reason: "无须投入更多筹码，保留摊牌权益。",
    });
  }

  if (legal.canCall) {
    options.push({
      type: "call",
      score: roundScore(strength - pressure * 0.72 + 0.16),
      reason: `跟注成本 ${legal.callAmount}，按牌力和成本评估继续。`,
    });
  }

  if (legal.canFold) {
    options.push({
      type: "fold",
      score: roundScore(1 - strength + pressure * 0.44),
      reason: "面对下注时放弃本手，避免继续投入。",
    });
  }

  if (legal.canBetRaise) {
    options.push({
      type: "betRaise",
      amount: legal.minTarget,
      score: roundScore(strength * 0.92 + 0.08),
      reason: `用最小合法目标 ${legal.minTarget} 施压并获取价值。`,
    });
  }

  if (legal.canAllIn) {
    options.push({
      type: "allIn",
      amount: legal.maxTarget,
      score: roundScore(strength * 1.08 - 0.22),
      reason: "最大化弃牌率或用强牌打满价值。",
    });
  }

  return options.sort((a, b) => b.score - a.score);
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

function roundScore(value) {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

if (typeof module !== "undefined") {
  module.exports = { chooseGtoBaselineAction, scoreGtoOptions, estimatePreSolverStrength };
}
