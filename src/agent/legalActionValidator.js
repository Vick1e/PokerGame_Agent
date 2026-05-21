const ACTIONS = new Set(["fold", "check", "call", "betRaise", "allIn"]);

function validateAgentAction(action, legalActions) {
  if (!action || !ACTIONS.has(action.type)) {
    return { ok: false, reason: "Unknown action type" };
  }

  if (action.type === "fold" && !legalActions.canFold) {
    return { ok: false, reason: "Fold is unavailable when checking is free" };
  }
  if (action.type === "check" && !legalActions.canCheck) {
    return { ok: false, reason: "Check is unavailable while facing a bet" };
  }
  if (action.type === "call" && !legalActions.canCall) {
    return { ok: false, reason: "Call is unavailable" };
  }
  if (action.type === "allIn" && !legalActions.canAllIn) {
    return { ok: false, reason: "All-in is unavailable" };
  }
  if (action.type === "betRaise") {
    const amount = Number(action.amount);
    const canUseShortAllIn = legalActions.canShortAllInRaise && amount === legalActions.maxTarget;
    if (!legalActions.canBetRaise && !canUseShortAllIn) {
      return { ok: false, reason: "Bet or raise is unavailable" };
    }
    if (!Number.isFinite(amount) || amount < legalActions.minTarget || amount > legalActions.maxTarget) {
      return { ok: false, reason: "Bet or raise amount is outside legal bounds" };
    }
  }

  return { ok: true };
}

if (typeof module !== "undefined") {
  module.exports = { validateAgentAction };
}
