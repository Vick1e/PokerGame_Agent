# PokerGame_Agent TODO

## Core Poker Engine

- [x] 52-card deck, shuffle, hole cards, community cards
- [x] Seven-card hand evaluation
- [x] Configurable players, stacks, blinds, dealer seat
- [x] Betting actions: fold, check, call, bet, raise, all-in
- [x] Turn order and current actor tracking
- [x] Complete preflop, flop, turn, river betting loops
- [x] Minimum raise, effective stack, and all-in validation
- [x] Folded player state
- [x] Side pot calculation and settlement
- [x] Dealer and blinds rotate per hand
- [x] Preserve stacks across hands

## Human vs Human

- [x] Human seat state
- [x] Current actor highlight
- [x] Betting amount input and action panel
- [x] Hidden hole cards outside current actor/showdown
- [ ] Hand history and action log

## Human vs Agent

- [x] Seat can be switched between human and Agent
- [x] Agent visible-state encoder
- [x] Agent legal-action validator
- [x] Local GTO baseline policy
- [x] DeepSeek request payload/client helper
- [x] DeepSeek backend proxy endpoint
- [x] DeepSeek + GTO decision pipeline
- [x] Agent explanation output
- [x] Frontend AI/GTO decision summary panel
- [x] Quick bet sizing buttons: min, 1/4 pot, 1/3 pot, 1/2 pot, pot
- [x] Agent action-route memory sent with every decision
- [x] GTO base memory sent with every Agent decision

## Later Product Work

- [ ] Online rooms
- [ ] WebSocket state sync
- [ ] Server-authoritative game state
- [ ] Reconnect and spectator mode
- [ ] Player statistics
- [ ] Replayable hand history
