const suits = [
  { symbol: "♠", name: "spades", red: false },
  { symbol: "♥", name: "hearts", red: true },
  { symbol: "♦", name: "diamonds", red: true },
  { symbol: "♣", name: "clubs", red: false },
];

const ranks = [
  { label: "2", value: 2 },
  { label: "3", value: 3 },
  { label: "4", value: 4 },
  { label: "5", value: 5 },
  { label: "6", value: 6 },
  { label: "7", value: 7 },
  { label: "8", value: 8 },
  { label: "9", value: 9 },
  { label: "10", value: 10 },
  { label: "J", value: 11 },
  { label: "Q", value: 12 },
  { label: "K", value: 13 },
  { label: "A", value: 14 },
];

const handNames = ["高牌", "一对", "两对", "三条", "顺子", "同花", "葫芦", "四条", "同花顺"];
const streetOrder = ["preflop", "flop", "turn", "river"];

const controls = {
  playerCount: document.querySelector("#playerCount"),
  startingStack: document.querySelector("#startingStack"),
  smallBlind: document.querySelector("#smallBlind"),
  bigBlind: document.querySelector("#bigBlind"),
  dealerSeat: document.querySelector("#dealerSeat"),
  agentSeats: document.querySelector("#agentSeats"),
  showAllCards: document.querySelector("#showAllCards"),
  playerNames: document.querySelector("#playerNames"),
  newHandBtn: document.querySelector("#newHandBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  betAmount: document.querySelector("#betAmount"),
  foldBtn: document.querySelector("#foldBtn"),
  checkBtn: document.querySelector("#checkBtn"),
  callBtn: document.querySelector("#callBtn"),
  betRaiseBtn: document.querySelector("#betRaiseBtn"),
  allInBtn: document.querySelector("#allInBtn"),
};

const views = {
  stageLabel: document.querySelector("#stageLabel"),
  potValue: document.querySelector("#potValue"),
  sidePots: document.querySelector("#sidePots"),
  communityCards: document.querySelector("#communityCards"),
  playersGrid: document.querySelector("#playersGrid"),
  actionLog: document.querySelector("#actionLog"),
  currentActor: document.querySelector("#currentActor"),
  agentDecisionPanel: document.querySelector("#agentDecisionPanel"),
};

let agentTimer = null;
let state = createEmptyState();

function createEmptyState() {
  return {
    deck: [],
    players: [],
    community: [],
    stage: "setup",
    currentPlayer: null,
    currentBet: 0,
    minRaise: 0,
    dealerSeat: 0,
    smallBlind: 10,
    bigBlind: 20,
    handNumber: 0,
    winners: [],
    sidePots: [],
    agentDecisions: [],
    actionLog: ["设置规则后点击“开始新局”"],
  };
}

function buildDeck() {
  return suits.flatMap((suit) =>
    ranks.map((rank) => ({
      ...rank,
      suit: suit.symbol,
      suitName: suit.name,
      red: suit.red,
      id: `${rank.label}${suit.symbol}`,
    })),
  );
}

function shuffle(deck) {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getSettings() {
  const count = clamp(Number(controls.playerCount.value), 2, 8);
  const startingStack = Math.max(100, Number(controls.startingStack.value) || 1000);
  const smallBlind = Math.max(1, Number(controls.smallBlind.value) || 10);
  const bigBlind = Math.max(smallBlind + 1, Number(controls.bigBlind.value) || 20);
  const dealerSeat = clamp(Number(controls.dealerSeat.value) - 1, 0, count - 1);
  const names = controls.playerNames.value
    .split("\n")
    .map((name) => name.trim())
    .filter(Boolean);
  const agentSeats = new Set(
    controls.agentSeats.value
      .split(/[,\s，]+/)
      .map((seat) => Number(seat) - 1)
      .filter((seat) => Number.isInteger(seat) && seat >= 0 && seat < count),
  );

  return { count, startingStack, smallBlind, bigBlind, dealerSeat, names, agentSeats };
}

function initializeRoster(settings) {
  state.players = Array.from({ length: settings.count }, (_, index) => ({
    id: `seat-${index + 1}`,
    name: settings.names[index] || `玩家 ${index + 1}`,
    stack: settings.startingStack,
    committed: 0,
    streetBet: 0,
    cards: [],
    folded: false,
    allIn: false,
    acted: false,
    hand: null,
    role: "",
    isAgent: settings.agentSeats.has(index),
    lastAction: "",
  }));
  state.dealerSeat = settings.dealerSeat;
  state.handNumber = 0;
}

function syncRosterSettings(settings) {
  if (!state.players.length || state.players.length !== settings.count) {
    initializeRoster(settings);
    return;
  }

  state.players.forEach((player, index) => {
    player.name = settings.names[index] || player.name || `玩家 ${index + 1}`;
    player.isAgent = settings.agentSeats.has(index);
  });
}

function startHand() {
  if (isHandInProgress()) {
    log("当前手牌还没结束，先完成本手或重置比赛。");
    render();
    return;
  }

  clearAgentTimer();
  const settings = getSettings();
  state.smallBlind = settings.smallBlind;
  state.bigBlind = settings.bigBlind;
  state.minRaise = settings.bigBlind;
  syncRosterSettings(settings);

  const activeSeats = seatsWithChips();
  if (activeSeats.length < 2) {
    log("至少需要 2 个有筹码的座位才能开始。");
    render();
    return;
  }

  state.deck = shuffle(buildDeck());
  state.community = [];
  state.stage = "preflop";
  state.currentBet = 0;
  state.minRaise = settings.bigBlind;
  state.winners = [];
  state.sidePots = [];
  state.agentDecisions = [];
  state.actionLog = [];
  state.handNumber += 1;

  if (state.handNumber > 1) {
    state.dealerSeat = nextSeatWithChips(state.dealerSeat);
  }

  state.players.forEach((player) => {
    player.committed = 0;
    player.streetBet = 0;
    player.cards = [];
    player.folded = player.stack <= 0;
    player.allIn = false;
    player.acted = false;
    player.hand = null;
    player.role = player.stack <= 0 ? "旁观" : "";
    player.lastAction = "";
  });

  assignButtonAndBlinds();
  dealHoleCards();
  state.currentPlayer = firstPreflopActor();
  if (state.currentPlayer === null && isBettingRoundComplete()) {
    advanceAfterBettingRound();
  } else {
    log(`第 ${state.handNumber} 手开始。盲注已收，${currentPlayerName()} 行动。`);
  }
  render();
  queueAgentIfNeeded();
}

function isHandInProgress() {
  return streetOrder.includes(state.stage);
}

function seatsWithChips() {
  return state.players.map((player, index) => (player.stack > 0 ? index : null)).filter((index) => index !== null);
}

function activeContestants() {
  return state.players
    .map((player, index) => (!player.folded && player.cards.length ? index : null))
    .filter((index) => index !== null);
}

function assignButtonAndBlinds() {
  const activeSeats = seatsWithChips();
  if (!activeSeats.includes(state.dealerSeat)) {
    state.dealerSeat = activeSeats[0];
  }

  const dealer = state.dealerSeat;
  const small = activeSeats.length === 2 ? dealer : nextSeatWithChips(dealer);
  const big = nextSeatWithChips(small);

  state.players[dealer].role = "庄";
  state.players[small].role = small === dealer ? "庄 / 小盲" : "小盲";
  state.players[big].role = "大盲";

  postBlind(small, state.smallBlind, "小盲");
  postBlind(big, state.bigBlind, "大盲");
  state.currentBet = Math.max(...state.players.map((player) => player.streetBet));
}

function postBlind(index, amount, label) {
  const paid = takeBet(index, amount);
  state.players[index].lastAction = `${label} ${paid}`;
  if (state.players[index].stack === 0) {
    state.players[index].allIn = true;
  }
}

function takeBet(index, amount) {
  const player = state.players[index];
  const paid = Math.min(player.stack, Math.max(0, amount));
  player.stack -= paid;
  player.streetBet += paid;
  player.committed += paid;
  if (player.stack === 0 && player.committed > 0) {
    player.allIn = true;
  }
  return paid;
}

function dealHoleCards() {
  for (let round = 0; round < 2; round += 1) {
    state.players.forEach((player) => {
      if (player.stack > 0 || player.committed > 0) {
        player.cards.push(drawCard());
      }
    });
  }
}

function drawCard() {
  return state.deck.pop();
}

function firstPreflopActor() {
  const activeSeats = activeContestants();
  const bigBlindSeat = state.players.findIndex((player) => player.role === "大盲");
  const start = activeSeats.length === 2 ? bigBlindSeat : bigBlindSeat;
  return nextActorAfter(start);
}

function nextSeatWithChips(index) {
  return findNextSeat(index, (player) => player.stack > 0);
}

function nextActorAfter(index) {
  return findNextSeat(index, (_, seat) => needsAction(seat));
}

function firstPostflopActor() {
  return nextActorAfter(state.dealerSeat);
}

function findNextSeat(index, predicate) {
  const total = state.players.length;
  for (let offset = 1; offset <= total; offset += 1) {
    const seat = (index + offset) % total;
    if (predicate(state.players[seat], seat)) {
      return seat;
    }
  }
  return null;
}

function needsAction(index) {
  const player = state.players[index];
  return Boolean(
    player &&
      player.cards.length &&
      !player.folded &&
      !player.allIn &&
      (!player.acted || player.streetBet < state.currentBet),
  );
}

function getLegalActions(index = state.currentPlayer) {
  const player = state.players[index];
  if (!player || !needsAction(index)) {
    return emptyLegalActions();
  }

  const callAmount = Math.max(0, state.currentBet - player.streetBet);
  const maxTarget = player.streetBet + player.stack;
  const minBet = state.currentBet === 0 ? state.bigBlind : state.currentBet + state.minRaise;
  const canBetRaise = maxTarget > state.currentBet && maxTarget >= minBet;
  const canShortAllInRaise = maxTarget > state.currentBet && maxTarget < minBet;

  return {
    canFold: callAmount > 0,
    canCheck: callAmount === 0,
    canCall: callAmount > 0 && player.stack > 0,
    canBetRaise,
    canAllIn: player.stack > 0,
    canShortAllInRaise,
    callAmount: Math.min(callAmount, player.stack),
    minTarget: Math.min(minBet, maxTarget),
    maxTarget,
    toCall: callAmount,
  };
}

function emptyLegalActions() {
  return {
    canFold: false,
    canCheck: false,
    canCall: false,
    canBetRaise: false,
    canAllIn: false,
    canShortAllInRaise: false,
    callAmount: 0,
    minTarget: 0,
    maxTarget: 0,
    toCall: 0,
  };
}

function applyAction(type) {
  if (!isHandInProgress() || state.currentPlayer === null) {
    log("当前没有可操作的手牌。");
    render();
    return;
  }

  const index = state.currentPlayer;
  const player = state.players[index];
  const legal = getLegalActions(index);

  if (type === "fold") {
    if (!legal.canFold) {
      log("没有人下注时不能弃牌，请选择过牌或下注。");
      render();
      return;
    }
    player.folded = true;
    player.acted = true;
    player.lastAction = "弃牌";
    log(`${player.name} 弃牌。`);
    finishAction(index);
    return;
  }

  if (type === "check") {
    if (!legal.canCheck) {
      log(`${player.name} 需要先跟注 ${legal.callAmount}。`);
      render();
      return;
    }
    player.acted = true;
    player.lastAction = "过牌";
    log(`${player.name} 过牌。`);
    finishAction(index);
    return;
  }

  if (type === "call") {
    if (!legal.canCall) {
      log("当前不能跟注。");
      render();
      return;
    }
    const paid = takeBet(index, legal.callAmount);
    player.acted = true;
    player.lastAction = paid < legal.toCall ? `全下跟注 ${paid}` : `跟注 ${paid}`;
    log(`${player.name} ${player.lastAction}。`);
    finishAction(index);
    return;
  }

  if (type === "betRaise") {
    const target = Math.floor(Number(controls.betAmount.value) || 0);
    const validation = validateBetTarget(player, legal, target);
    if (!validation.ok) {
      log(validation.message);
      render();
      return;
    }
    commitToTarget(index, target);
    const verb = state.currentBet === target && legal.toCall === 0 ? "下注" : "加注";
    player.lastAction = `${verb}至 ${target}`;
    log(`${player.name} ${player.lastAction}。`);
    finishAction(index);
    return;
  }

  if (type === "allIn") {
    if (!legal.canAllIn) {
      log("当前不能全下。");
      render();
      return;
    }
    const previousBet = state.currentBet;
    const target = legal.maxTarget;
    commitToTarget(index, target);
    player.lastAction = target > previousBet ? `全下至 ${target}` : `全下跟注 ${target}`;
    log(`${player.name} ${player.lastAction}。`);
    finishAction(index);
  }
}

function validateBetTarget(player, legal, target) {
  if (!Number.isFinite(target) || target <= player.streetBet) {
    return { ok: false, message: "请输入大于当前本轮投入的目标金额。" };
  }
  if (target > legal.maxTarget) {
    return { ok: false, message: "目标金额超过该玩家剩余筹码。" };
  }
  if (target <= state.currentBet) {
    return { ok: false, message: "下注或加注必须超过当前最高注。" };
  }
  if (target < legal.minTarget && target !== legal.maxTarget) {
    return { ok: false, message: `最小下注/加注目标是 ${legal.minTarget}，短额只能选择全下。` };
  }
  if (!legal.canBetRaise && target !== legal.maxTarget) {
    return { ok: false, message: "当前筹码不足以做完整加注，只能跟注或全下。" };
  }
  return { ok: true };
}

function commitToTarget(index, target) {
  const player = state.players[index];
  const previousBet = state.currentBet;
  takeBet(index, target - player.streetBet);
  const newTarget = player.streetBet;

  if (newTarget > previousBet) {
    const raiseSize = newTarget - previousBet;
    state.currentBet = newTarget;
    if (previousBet === 0 && newTarget >= state.bigBlind) {
      state.minRaise = Math.max(state.bigBlind, newTarget);
    } else if (previousBet > 0 && raiseSize >= state.minRaise) {
      state.minRaise = raiseSize;
    }
  }

  player.acted = true;
}

function finishAction(actorIndex) {
  if (awardIfOnlyOneLeft()) {
    render();
    return;
  }

  if (isBettingRoundComplete()) {
    advanceAfterBettingRound();
    render();
    queueAgentIfNeeded();
    return;
  }

  state.currentPlayer = nextActorAfter(actorIndex);
  render();
  queueAgentIfNeeded();
}

function awardIfOnlyOneLeft() {
  const contenders = activeContestants();
  if (contenders.length !== 1) {
    return false;
  }

  const winner = contenders[0];
  const amount = totalPot();
  state.players[winner].stack += amount;
  state.winners = [winner];
  state.currentPlayer = null;
  state.stage = "finished";
  state.sidePots = [{ amount, eligible: [winner], winners: [winner] }];
  log(`${state.players[winner].name} 赢得底池 ${amount}。`);
  return true;
}

function isBettingRoundComplete() {
  const contenders = activeContestants();
  if (contenders.length <= 1) {
    return true;
  }
  return contenders.every((index) => {
    const player = state.players[index];
    return player.allIn || (player.acted && player.streetBet === state.currentBet);
  });
}

function advanceAfterBettingRound() {
  const actorsWithChips = activeContestants().filter((index) => !state.players[index].allIn);
  if (actorsWithChips.length <= 1) {
    dealRemainingBoard();
    showdown();
    return;
  }

  if (state.stage === "river") {
    showdown();
    return;
  }

  advanceStreet();
}

function advanceStreet() {
  const nextStreet = {
    preflop: "flop",
    flop: "turn",
    turn: "river",
  }[state.stage];

  state.stage = nextStreet;
  state.currentBet = 0;
  state.minRaise = state.bigBlind;
  state.players.forEach((player) => {
    player.streetBet = 0;
    player.acted = player.folded || player.allIn;
    player.lastAction = player.folded ? player.lastAction : "";
  });

  if (nextStreet === "flop") {
    state.community.push(drawCard(), drawCard(), drawCard());
  } else {
    state.community.push(drawCard());
  }

  state.currentPlayer = firstPostflopActor();
  if (state.currentPlayer === null) {
    advanceAfterBettingRound();
    return;
  }

  log(`${stageText()}开始，${currentPlayerName()} 行动。`);
}

function dealRemainingBoard() {
  while (state.community.length < 5) {
    state.community.push(drawCard());
  }
}

function showdown() {
  dealRemainingBoard();
  const contenders = activeContestants();
  const evaluated = contenders.map((index) => ({
    index,
    result: evaluateSeven([...state.players[index].cards, ...state.community]),
  }));

  evaluated.forEach(({ index, result }) => {
    state.players[index].hand = result;
  });

  const pots = buildSidePots();
  const resultLines = [];
  const allWinners = new Set();

  pots.forEach((pot, potIndex) => {
    const eligibleResults = evaluated.filter(({ index }) => pot.eligible.includes(index));
    const best = eligibleResults.reduce((winner, current) =>
      compareHands(current.result, winner.result) > 0 ? current : winner,
    );
    const winners = eligibleResults.filter(({ result }) => compareHands(result, best.result) === 0).map(({ index }) => index);
    distributePot(pot.amount, winners);
    pot.winners = winners;
    pot.handName = handNames[best.result.category];
    winners.forEach((index) => allWinners.add(index));
    resultLines.push(
      `${potIndex + 1}号池 ${pot.amount}: ${winners.map((index) => state.players[index].name).join("、")} (${pot.handName})`,
    );
  });

  state.sidePots = pots;
  state.winners = [...allWinners];
  state.currentPlayer = null;
  state.stage = "showdown";
  log(`摊牌结算：${resultLines.join("；")}`);
}

function buildSidePots() {
  const levels = [...new Set(state.players.filter((player) => player.committed > 0).map((player) => player.committed))].sort(
    (a, b) => a - b,
  );
  const pots = [];
  let previous = 0;

  levels.forEach((level) => {
    const contributors = state.players
      .map((player, index) => (player.committed >= level ? index : null))
      .filter((index) => index !== null);
    const eligible = contributors.filter((index) => !state.players[index].folded);
    const amount = (level - previous) * contributors.length;

    if (amount > 0 && eligible.length) {
      pots.push({ amount, eligible, winners: [] });
    }
    previous = level;
  });

  return pots;
}

function distributePot(amount, winners) {
  const share = Math.floor(amount / winners.length);
  let remainder = amount % winners.length;
  winners.forEach((index) => {
    state.players[index].stack += share + (remainder > 0 ? 1 : 0);
    remainder -= 1;
  });
}

function totalPot() {
  return state.players.reduce((sum, player) => sum + player.committed, 0);
}

function evaluateSeven(cards) {
  const combos = combinations(cards, 5);
  return combos
    .map(evaluateFive)
    .sort(compareHands)
    .at(-1);
}

function evaluateFive(cards) {
  const sorted = [...cards].sort((a, b) => b.value - a.value);
  const counts = countBy(sorted, "value");
  const groups = Object.entries(counts)
    .map(([value, count]) => ({ value: Number(value), count }))
    .sort((a, b) => b.count - a.count || b.value - a.value);
  const isFlush = new Set(cards.map((card) => card.suit)).size === 1;
  const straightHigh = getStraightHigh(sorted.map((card) => card.value));

  if (isFlush && straightHigh) return score(8, [straightHigh], cards);
  if (groups[0].count === 4) return score(7, [groups[0].value, kicker(groups, [groups[0].value])], cards);
  if (groups[0].count === 3 && groups[1].count === 2) return score(6, [groups[0].value, groups[1].value], cards);
  if (isFlush) return score(5, sorted.map((card) => card.value), cards);
  if (straightHigh) return score(4, [straightHigh], cards);
  if (groups[0].count === 3) return score(3, [groups[0].value, ...kickers(groups, [groups[0].value], 2)], cards);
  if (groups[0].count === 2 && groups[1].count === 2) {
    const pairValues = groups
      .slice(0, 2)
      .map((group) => group.value)
      .sort((a, b) => b - a);
    return score(2, [...pairValues, kicker(groups, pairValues)], cards);
  }
  if (groups[0].count === 2) return score(1, [groups[0].value, ...kickers(groups, [groups[0].value], 3)], cards);
  return score(0, sorted.map((card) => card.value), cards);
}

function score(category, values, cards) {
  return { category, values, cards };
}

function compareHands(a, b) {
  if (a.category !== b.category) {
    return a.category - b.category;
  }
  for (let i = 0; i < Math.max(a.values.length, b.values.length); i += 1) {
    const diff = (a.values[i] || 0) - (b.values[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    acc[item[key]] = (acc[item[key]] || 0) + 1;
    return acc;
  }, {});
}

function getStraightHigh(values) {
  const unique = [...new Set(values)].sort((a, b) => b - a);
  if (unique.includes(14)) unique.push(1);

  for (let i = 0; i <= unique.length - 5; i += 1) {
    const slice = unique.slice(i, i + 5);
    if (slice[0] - slice[4] === 4) {
      return slice[0];
    }
  }
  return 0;
}

function kicker(groups, excluded) {
  return kickers(groups, excluded, 1)[0];
}

function kickers(groups, excluded, limit) {
  return groups
    .filter((group) => !excluded.includes(group.value))
    .flatMap((group) => Array.from({ length: group.count }, () => group.value))
    .sort((a, b) => b - a)
    .slice(0, limit);
}

function combinations(items, size) {
  const result = [];
  const walk = (start, picked) => {
    if (picked.length === size) {
      result.push(picked);
      return;
    }
    for (let i = start; i <= items.length - (size - picked.length); i += 1) {
      walk(i + 1, [...picked, items[i]]);
    }
  };
  walk(0, []);
  return result;
}

function queueAgentIfNeeded() {
  clearAgentTimer();
  if (!isHandInProgress() || state.currentPlayer === null) {
    return;
  }

  const player = state.players[state.currentPlayer];
  if (!player.isAgent) {
    return;
  }

  agentTimer = window.setTimeout(() => {
    if (state.currentPlayer !== null && state.players[state.currentPlayer]?.isAgent) {
      applyAgentAction();
    }
  }, 650);
}

function clearAgentTimer() {
  if (agentTimer) {
    window.clearTimeout(agentTimer);
    agentTimer = null;
  }
}

async function applyAgentAction() {
  const seat = state.currentPlayer;
  const action = await requestAgentAction(seat);
  if (state.currentPlayer !== seat || !isHandInProgress()) {
    return;
  }

  if (action.amount) {
    controls.betAmount.value = action.amount;
  }
  if (action.source || action.reason) {
    state.players[seat].lastAction = `${action.source || "Agent"}: ${action.reason || ""}`;
  }
  recordAgentDecision(seat, action);
  applyAction(action.type);
}

async function requestAgentAction(index) {
  const snapshot = buildAgentSnapshot(index);
  try {
    const response = await fetch("/api/agent/act", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
    });

    if (!response.ok) {
      throw new Error(`Agent API ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    const fallback = chooseBaselineAgentAction(index);
    return { ...fallback, reason: error.message, gtoRecommendation: fallback, gtoOptions: fallback.gtoOptions || [] };
  }
}

function buildAgentSnapshot(index) {
  const player = state.players[index];
  return {
    seatIndex: index,
    stage: state.stage,
    holeCards: player.cards,
    communityCards: state.community,
    pot: totalPot(),
    currentBet: state.currentBet,
    minRaise: state.minRaise,
    bigBlind: state.bigBlind,
    stack: player.stack,
    committed: player.committed,
    streetBet: player.streetBet,
    position: player.role,
    legalActions: getLegalActions(index),
    opponents: state.players
      .map((seat, seatIndex) => ({
        seatIndex,
        name: seat.name,
        stack: seat.stack,
        committed: seat.committed,
        streetBet: seat.streetBet,
        folded: seat.folded,
        allIn: seat.allIn,
        role: seat.role,
        lastAction: seat.lastAction,
      }))
      .filter((seat) => seat.seatIndex !== index),
  };
}

function chooseBaselineAgentAction(index) {
  const legal = getLegalActions(index);
  const player = state.players[index];
  const strength = estimateAgentStrength(player);
  const options = scoreLocalAgentOptions(legal, player, strength);
  const best = options[0] || { type: "check", score: 0, reason: "无合法动作。" };

  return {
    type: best.type,
    amount: best.amount,
    source: "local-gto-baseline",
    confidence: best.score,
    reason: best.reason,
    gtoOptions: options,
  };
}

function scoreLocalAgentOptions(legal, player, strength) {
  const pressure = legal.toCall && player.stack ? Math.min(1, legal.toCall / Math.max(1, player.stack)) : 0;
  const options = [];

  if (legal.canCheck) {
    options.push({ type: "check", score: roundScore(0.62 - strength * 0.16), reason: "免费继续，保留权益。" });
  }
  if (legal.canCall) {
    options.push({
      type: "call",
      score: roundScore(strength - pressure * 0.68 + 0.14),
      reason: `跟注 ${legal.callAmount}，看后续牌面。`,
    });
  }
  if (legal.canFold) {
    options.push({ type: "fold", score: roundScore(1 - strength + pressure * 0.4), reason: "面对压力时控制损失。" });
  }
  if (legal.canBetRaise) {
    options.push({
      type: "betRaise",
      amount: legal.minTarget,
      score: roundScore(strength * 0.9 + 0.08),
      reason: `加注到 ${legal.minTarget} 施压。`,
    });
  }
  if (legal.canAllIn) {
    options.push({
      type: "allIn",
      amount: legal.maxTarget,
      score: roundScore(strength * 1.05 - 0.22),
      reason: "高风险最大压力线。",
    });
  }

  return options.sort((a, b) => b.score - a.score);
}

function estimateAgentStrength(player) {
  if (state.community.length >= 3) {
    const cards = [...player.cards, ...state.community];
    if (cards.length >= 5) {
      const result = evaluateSeven(cards);
      return (result.category + 1) / handNames.length;
    }
  }

  const [a, b] = player.cards;
  if (!a || !b) return 0.35;
  const high = Math.max(a.value, b.value);
  const pairBonus = a.value === b.value ? 0.26 : 0;
  const suitedBonus = a.suit === b.suit ? 0.05 : 0;
  const connectedBonus = Math.abs(a.value - b.value) <= 1 ? 0.04 : 0;
  return Math.min(0.95, high / 20 + pairBonus + suitedBonus + connectedBonus);
}

function recordAgentDecision(seat, action) {
  const options = action.gtoOptions || action.gtoRecommendation?.gtoOptions || [];
  state.agentDecisions.unshift({
    seat,
    playerName: state.players[seat]?.name || `座位 ${seat + 1}`,
    stage: stageText(),
    finalAction: action,
    gtoRecommendation: action.gtoRecommendation || null,
    gtoOptions: options,
    createdAt: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
  });
  state.agentDecisions = state.agentDecisions.slice(0, 4);
}

function render() {
  const legal = getLegalActions();
  views.stageLabel.textContent = stageText();
  views.potValue.textContent = totalPot();
  views.sidePots.innerHTML = buildSidePots().map(sidePotTemplate).join("");
  views.communityCards.innerHTML = state.community.map(cardTemplate).join("") || emptyCards(5);
  views.playersGrid.innerHTML = state.players.map(playerTemplate).join("");
  views.actionLog.textContent = state.actionLog.at(-1) || "";
  views.currentActor.innerHTML = currentActorTemplate(legal);
  views.agentDecisionPanel.innerHTML = agentDecisionPanelTemplate();
  updateActionControls(legal);
}

function playerTemplate(player, index) {
  const classNames = [
    "player-card",
    state.currentPlayer === index ? "current" : "",
    state.winners.includes(index) ? "winner" : "",
    player.folded ? "folded" : "",
    player.allIn ? "all-in" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const badges = [
    player.role ? `<span class="badge">${player.role}</span>` : "",
    player.isAgent ? '<span class="badge">Agent</span>' : '<span class="badge">真人</span>',
    state.currentPlayer === index ? '<span class="badge active">行动中</span>' : "",
    player.folded ? '<span class="badge danger">已弃牌</span>' : "",
    player.allIn && !player.folded ? '<span class="badge">All-in</span>' : "",
  ].join("");
  const handName = player.hand ? handNames[player.hand.category] : player.lastAction || "等待行动";
  const cards = shouldShowCards(player, index) ? player.cards.map(cardTemplate).join("") : emptyCards(player.cards.length || 2);

  return `
    <article class="${classNames}">
      <div class="player-head">
        <span class="player-name">${escapeHtml(player.name)}</span>
        <span class="stack">${player.stack}</span>
      </div>
      <div class="badge-row">${badges}</div>
      <div class="hand-row">${cards}</div>
      <div class="player-meta">
        <span>本轮 ${player.streetBet}</span>
        <span>本手 ${player.committed}</span>
      </div>
      <div class="hand-name">${escapeHtml(handName)}</div>
    </article>
  `;
}

function shouldShowCards(player, index) {
  if (!player.cards.length) return false;
  if (controls.showAllCards.checked) return true;
  if (state.stage === "showdown" && !player.folded) return true;
  if (state.currentPlayer === index && !player.isAgent) return true;
  return false;
}

function sidePotTemplate(pot, index) {
  return `<span class="side-pot">${index + 1}号池 ${pot.amount}</span>`;
}

function currentActorTemplate(legal) {
  if (state.stage === "setup") {
    return "等待开局";
  }
  if (state.stage === "showdown" || state.stage === "finished") {
    return `本手结束。点击“开始新局”继续。`;
  }
  if (state.currentPlayer === null) {
    return "正在推进牌局";
  }

  const player = state.players[state.currentPlayer];
  const agentHint = player.isAgent ? "Agent 自动行动中" : "真人玩家行动";
  const callText = legal.callAmount ? `需跟注 ${legal.callAmount}` : "可过牌";
  return `<strong>${escapeHtml(player.name)}</strong><br>${agentHint} · ${callText} · 最小目标 ${legal.minTarget || 0}`;
}

function agentDecisionPanelTemplate() {
  if (!state.agentDecisions.length) {
    return "等待 Agent 行动。这里会展示 GTO 每个合法选择的评分、推荐动作和 DeepSeek 最终动作摘要。";
  }

  return state.agentDecisions.map(decisionTemplate).join("");
}

function decisionTemplate(decision) {
  const final = decision.finalAction;
  const options = decision.gtoOptions.length ? decision.gtoOptions : [final];
  return `
    <article class="decision-card">
      <div class="decision-title">
        <span>${escapeHtml(decision.playerName)} · ${escapeHtml(decision.stage)}</span>
        <span>${escapeHtml(decision.createdAt)}</span>
      </div>
      <div>最终：${escapeHtml(actionLabel(final))} · ${escapeHtml(final.source || "agent")}${final.confidence ? ` · 置信 ${Math.round(final.confidence * 100)}%` : ""}</div>
      <div>理由：${escapeHtml(final.reason || "按 GTO baseline 和合法动作选择。")}</div>
      <div class="decision-options">
        ${options.map(optionTemplate).join("")}
      </div>
    </article>
  `;
}

function optionTemplate(option) {
  return `
    <div class="decision-option">
      <span>${escapeHtml(actionLabel(option))}</span>
      <span class="decision-score">${Math.round((option.score || option.confidence || 0) * 100)}</span>
      <span>${escapeHtml(option.reason || "")}</span>
    </div>
  `;
}

function actionLabel(action) {
  const labels = {
    fold: "弃牌",
    check: "过牌",
    call: "跟注",
    betRaise: "下注/加注",
    allIn: "全下",
  };
  const amount = action.amount ? ` ${action.amount}` : "";
  return `${labels[action.type] || action.type || "未知"}${amount}`;
}

function updateActionControls(legal) {
  const disabled = state.currentPlayer === null || state.players[state.currentPlayer]?.isAgent || !isHandInProgress();

  controls.foldBtn.disabled = disabled || !legal.canFold;
  controls.checkBtn.disabled = disabled || !legal.canCheck;
  controls.callBtn.disabled = disabled || !legal.canCall;
  controls.betRaiseBtn.disabled = disabled || (!legal.canBetRaise && !legal.canShortAllInRaise);
  controls.allInBtn.disabled = disabled || !legal.canAllIn;
  controls.betAmount.disabled = disabled || (!legal.canBetRaise && !legal.canShortAllInRaise);
  controls.callBtn.textContent = legal.callAmount ? `跟注 ${legal.callAmount}` : "跟注";
  controls.betRaiseBtn.textContent = state.currentBet > 0 ? "加注" : "下注";

  if (!controls.betAmount.disabled) {
    controls.betAmount.min = legal.minTarget;
    controls.betAmount.max = legal.maxTarget;
    if (Number(controls.betAmount.value) < legal.minTarget || Number(controls.betAmount.value) > legal.maxTarget) {
      controls.betAmount.value = legal.minTarget;
    }
  }

  controls.newHandBtn.textContent = state.handNumber ? "开始下一局" : "开始新局";
}

function cardTemplate(card) {
  return `
    <div class="card ${card.red ? "red" : ""}" title="${card.id}">
      <span class="rank">${card.label}</span>
      <span></span>
      <span class="suit">${card.suit}</span>
    </div>
  `;
}

function emptyCards(count) {
  return Array.from({ length: count }, () => '<div class="card back"><span></span><span></span><span></span></div>').join("");
}

function stageText() {
  return (
    {
      setup: "等待开局",
      preflop: "翻牌前",
      flop: "翻牌圈",
      turn: "转牌圈",
      river: "河牌圈",
      showdown: "摊牌",
      finished: "本手结束",
    }[state.stage] || "未知阶段"
  );
}

function currentPlayerName() {
  return state.currentPlayer === null ? "无人" : state.players[state.currentPlayer].name;
}

function log(message) {
  state.actionLog.push(message);
  if (state.actionLog.length > 80) {
    state.actionLog.shift();
  }
}

function resetMatch() {
  clearAgentTimer();
  state = createEmptyState();
  log("已重置比赛。");
  render();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function roundScore(value) {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char],
  );
}

controls.newHandBtn.addEventListener("click", startHand);
controls.resetBtn.addEventListener("click", resetMatch);
controls.foldBtn.addEventListener("click", () => applyAction("fold"));
controls.checkBtn.addEventListener("click", () => applyAction("check"));
controls.callBtn.addEventListener("click", () => applyAction("call"));
controls.betRaiseBtn.addEventListener("click", () => applyAction("betRaise"));
controls.allInBtn.addEventListener("click", () => applyAction("allIn"));
controls.showAllCards.addEventListener("change", render);

window.PokerGame = {
  getState: () => state,
  getLegalActions,
  buildAgentSnapshot,
  buildSidePots,
  evaluateSeven,
  compareHands,
};

render();
