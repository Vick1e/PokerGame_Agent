function encodeAgentState(gameState, seatIndex) {
  const player = gameState.players[seatIndex];
  if (!player) {
    throw new Error(`Unknown agent seat: ${seatIndex}`);
  }

  return {
    seatIndex,
    stage: gameState.stage,
    holeCards: player.cards,
    communityCards: gameState.community,
    pot: gameState.players.reduce((sum, seat) => sum + seat.committed, 0),
    currentBet: gameState.currentBet,
    minRaise: gameState.minRaise,
    stack: player.stack,
    committed: player.committed,
    streetBet: player.streetBet,
    position: player.role,
    legalActions: gameState.getLegalActions ? gameState.getLegalActions(seatIndex) : null,
    opponents: gameState.players
      .map((seat, index) => ({
        seatIndex: index,
        name: seat.name,
        stack: seat.stack,
        committed: seat.committed,
        streetBet: seat.streetBet,
        folded: seat.folded,
        allIn: seat.allIn,
        role: seat.role,
        lastAction: seat.lastAction,
      }))
      .filter((seat) => seat.seatIndex !== seatIndex),
  };
}

if (typeof module !== "undefined") {
  module.exports = { encodeAgentState };
}
