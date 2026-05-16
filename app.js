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

const handNames = [
  "高牌",
  "一对",
  "两对",
  "三条",
  "顺子",
  "同花",
  "葫芦",
  "四条",
  "同花顺",
];

const controls = {
  playerCount: document.querySelector("#playerCount"),
  startingStack: document.querySelector("#startingStack"),
  smallBlind: document.querySelector("#smallBlind"),
  bigBlind: document.querySelector("#bigBlind"),
  dealerSeat: document.querySelector("#dealerSeat"),
  playerNames: document.querySelector("#playerNames"),
  newHandBtn: document.querySelector("#newHandBtn"),
  flopBtn: document.querySelector("#flopBtn"),
  turnBtn: document.querySelector("#turnBtn"),
  riverBtn: document.querySelector("#riverBtn"),
  showdownBtn: document.querySelector("#showdownBtn"),
  resetBtn: document.querySelector("#resetBtn"),
};

const views = {
  stageLabel: document.querySelector("#stageLabel"),
  potValue: document.querySelector("#potValue"),
  communityCards: document.querySelector("#communityCards"),
  playersGrid: document.querySelector("#playersGrid"),
  actionLog: document.querySelector("#actionLog"),
};

let state = createEmptyState();

function createEmptyState() {
  return {
    deck: [],
    players: [],
    community: [],
    pot: 0,
    stage: "setup",
    winners: [],
    dealerSeat: 0,
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

  return {
    count,
    startingStack,
    smallBlind,
    bigBlind,
    dealerSeat,
    names,
  };
}

function startHand() {
  const settings = getSettings();
  state = {
    deck: shuffle(buildDeck()),
    players: Array.from({ length: settings.count }, (_, index) => ({
      name: settings.names[index] || `玩家 ${index + 1}`,
      stack: settings.startingStack,
      bet: 0,
      cards: [],
      hand: null,
      role: "",
    })),
    community: [],
    pot: 0,
    stage: "preflop",
    winners: [],
    dealerSeat: settings.dealerSeat,
  };

  assignBlinds(settings);
  dealHoleCards();
  log("新局开始。盲注已收，手牌已发。");
  render();
}

function assignBlinds(settings) {
  const playerCount = state.players.length;
  const dealer = settings.dealerSeat;
  const small = (dealer + 1) % playerCount;
  const big = (dealer + 2) % playerCount;

  state.players[dealer].role = "庄";
  state.players[small].role = "小盲";
  state.players[big].role = "大盲";
  takeBet(small, settings.smallBlind);
  takeBet(big, settings.bigBlind);
}

function takeBet(index, amount) {
  const player = state.players[index];
  const bet = Math.min(player.stack, amount);
  player.stack -= bet;
  player.bet += bet;
  state.pot += bet;
}

function dealHoleCards() {
  for (let round = 0; round < 2; round += 1) {
    state.players.forEach((player) => player.cards.push(drawCard()));
  }
}

function drawCard() {
  return state.deck.pop();
}

function reveal(stage) {
  if (state.stage === "setup") {
    log("请先开始新局。");
    return;
  }

  const flow = {
    flop: { needed: 0, cards: 3, label: "翻牌", next: "flop" },
    turn: { needed: 3, cards: 1, label: "转牌", next: "turn" },
    river: { needed: 4, cards: 1, label: "河牌", next: "river" },
  };
  const step = flow[stage];

  if (state.community.length !== step.needed) {
    log(`现在不能${step.label}。`);
    return;
  }

  for (let i = 0; i < step.cards; i += 1) {
    state.community.push(drawCard());
  }
  state.stage = step.next;
  log(`${step.label}完成。`);
  render();
}

function showdown() {
  if (state.community.length < 5) {
    log("公共牌不足五张，先发到河牌。");
    return;
  }

  const evaluated = state.players.map((player, index) => ({
    index,
    result: evaluateSeven([...player.cards, ...state.community]),
  }));
  evaluated.forEach(({ index, result }) => {
    state.players[index].hand = result;
  });

  const best = evaluated.reduce((winner, current) =>
    compareHands(current.result, winner.result) > 0 ? current : winner,
  );
  const winners = evaluated.filter(({ result }) => compareHands(result, best.result) === 0);
  const share = Math.floor(state.pot / winners.length);
  winners.forEach(({ index }) => {
    state.players[index].stack += share;
  });

  state.winners = winners.map(({ index }) => index);
  state.stage = "showdown";
  log(`胜者：${state.winners.map((i) => state.players[i].name).join("、")}，牌型 ${handNames[best.result.category]}。`);
  render();
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

  if (isFlush && straightHigh) {
    return score(8, [straightHigh], cards);
  }
  if (groups[0].count === 4) {
    return score(7, [groups[0].value, kicker(groups, [groups[0].value])], cards);
  }
  if (groups[0].count === 3 && groups[1].count === 2) {
    return score(6, [groups[0].value, groups[1].value], cards);
  }
  if (isFlush) {
    return score(5, sorted.map((card) => card.value), cards);
  }
  if (straightHigh) {
    return score(4, [straightHigh], cards);
  }
  if (groups[0].count === 3) {
    return score(3, [groups[0].value, ...kickers(groups, [groups[0].value], 2)], cards);
  }
  if (groups[0].count === 2 && groups[1].count === 2) {
    const pairValues = groups.slice(0, 2).map((group) => group.value).sort((a, b) => b - a);
    return score(2, [...pairValues, kicker(groups, pairValues)], cards);
  }
  if (groups[0].count === 2) {
    return score(1, [groups[0].value, ...kickers(groups, [groups[0].value], 3)], cards);
  }
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

function render() {
  views.stageLabel.textContent = stageText();
  views.potValue.textContent = state.pot;
  views.communityCards.innerHTML = state.community.map(cardTemplate).join("") || emptyCards(5);
  views.playersGrid.innerHTML = state.players.map(playerTemplate).join("");
}

function playerTemplate(player, index) {
  const winnerClass = state.winners.includes(index) ? " winner" : "";
  const role = player.role ? `<span class="badge">${player.role}</span>` : "";
  const handName = player.hand ? handNames[player.hand.category] : "等待摊牌";

  return `
    <article class="player-card${winnerClass}">
      <div class="player-head">
        <span class="player-name">${escapeHtml(player.name)}</span>
        <span class="stack">${player.stack}</span>
      </div>
      ${role}
      <div class="hand-row">${player.cards.map(cardTemplate).join("") || emptyCards(2)}</div>
      <div class="hand-name">${handName}${player.bet ? ` · 已投 ${player.bet}` : ""}</div>
    </article>
  `;
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
  return {
    setup: "等待开局",
    preflop: "翻牌前",
    flop: "翻牌圈",
    turn: "转牌圈",
    river: "河牌圈",
    showdown: "摊牌",
  }[state.stage];
}

function log(message) {
  views.actionLog.textContent = message;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char],
  );
}

controls.newHandBtn.addEventListener("click", startHand);
controls.flopBtn.addEventListener("click", () => reveal("flop"));
controls.turnBtn.addEventListener("click", () => reveal("turn"));
controls.riverBtn.addEventListener("click", () => reveal("river"));
controls.showdownBtn.addEventListener("click", showdown);
controls.resetBtn.addEventListener("click", () => {
  state = createEmptyState();
  log("已重置。");
  render();
});

render();
