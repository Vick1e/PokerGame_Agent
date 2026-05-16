# PokerGame_Agent 项目计划

## 项目定位

PokerGame_Agent 是一个可自定义规则的德州扑克应用。当前版本已经具备静态单机原型能力：设置玩家、筹码、盲注，发牌并结算牌型。下一阶段目标是把它升级成一个完整可玩的对战系统，支持人与人对战，以及人与 Agent 对战。

Agent 由两部分组成：

- DeepSeek 模型：负责把牌局信息转化为可解释的决策风格、对局语言、策略摘要和个性化表现。
- GTO 策略模块：负责提供接近博弈论最优的动作范围、下注尺度、胜率估计和动作约束。

DeepSeek 不直接绕过规则做决定，最终动作必须经过游戏引擎校验。

## 核心目标

1. 支持完整德州扑克流程：入座、盲注、发牌、四轮下注、公共牌、摊牌、分池、下一局。
2. 支持人与人对战：先做同屏本地对战，再扩展到多人在线房间。
3. 支持人与 Agent 对战：玩家可以选择任意座位由 DeepSeek + GTO Agent 接管。
4. 保证游戏公平性：隐藏手牌不可泄露给非所属玩家或 Agent。
5. 保持策略可调：Agent 可设置保守、均衡、激进等风格，但动作仍受 GTO 和合法动作约束。

## 对战模式

### 1. 人与人对战

MVP 先做本地同屏模式：

- 每个座位可以标记为真人玩家。
- 当前行动玩家高亮显示。
- 支持 fold、check、call、bet、raise、all-in。
- 非当前玩家的手牌可选择隐藏，适合线下轮流操作。

进阶版本做在线房间：

- 创建房间、加入房间、选择座位。
- WebSocket 同步牌局状态。
- 服务端保存权威牌局状态，客户端只负责展示和提交动作。
- 支持断线重连和观战模式。

### 2. 人与 Agent 对战

玩家可以把任意座位切换为 Agent：

- Agent 自动等待轮到自己行动。
- Agent 只接收自己应知道的信息：自己的手牌、公共牌、下注历史、筹码、位置和合法动作。
- GTO 模块先生成动作建议和概率分布。
- DeepSeek 根据 GTO 建议、桌面状态和风格参数，选择一个最终动作。
- 游戏引擎校验动作合法性，不合法则回退到 GTO 默认动作。

## 技术架构

### 前端

当前静态页面继续作为原型基础，后续建议升级为组件化结构：

- TableView：牌桌、公共牌、底池、阶段状态。
- PlayerSeat：玩家座位、筹码、下注、手牌显示。
- ActionPanel：当前玩家操作按钮和下注输入。
- SettingsPanel：房间、规则、Agent 配置。
- HandHistory：牌局日志和动作历史。

### 游戏引擎

需要从 `app.js` 中抽出纯逻辑模块：

- Deck：洗牌、发牌。
- HandEvaluator：七选五牌型比较。
- GameState：玩家、筹码、底池、公共牌、阶段。
- BettingEngine：下注轮、最小加注、all-in、边池。
- RulesValidator：校验动作是否合法。
- RoundController：推进 preflop、flop、turn、river、showdown。

游戏引擎要做到无 UI 依赖，方便前端、服务端和测试共同使用。

### Agent 服务

DeepSeek API 密钥不能放在浏览器端。需要新增一个后端服务：

- `/api/agent/act`：输入牌局状态，返回 Agent 动作。
- `/api/agent/explain`：可选，返回动作解释或对局评论。
- `/api/agent/config`：读取模型、温度、风格和策略参数。

Agent 决策流程：

1. 游戏引擎生成当前 Agent 可见状态。
2. RulesValidator 生成合法动作列表。
3. GTO 策略模块输出动作概率、推荐下注尺度和风险说明。
4. DeepSeek 在合法动作范围内选择动作，并给出简短理由。
5. 服务端再次校验动作，写入牌局历史。

## GTO 策略模块设计

MVP 不需要一开始实现完整求解器，可以按阶段逐步增强。

### Phase 1：规则型基线

- 按位置和手牌强度建立 preflop 范围表。
- flop/turn/river 使用牌力、听牌、位置、底池赔率做启发式决策。
- 支持固定下注尺度：33%、50%、75%、100% pot、all-in。

### Phase 2：概率与模拟

- 增加 Monte Carlo equity 估算。
- 计算胜率、补牌数、底池赔率和隐含赔率。
- 根据胜率和下注成本调整 fold/call/raise 概率。

### Phase 3：GTO 近似策略

- 引入预计算策略表或外部求解数据。
- 使用 action abstraction 限制下注尺度。
- 根据位置、SPR、牌面纹理和下注历史选择混合策略。
- 记录 Agent 实际频率，用于避免长期偏离目标策略。

## DeepSeek Agent 设计

DeepSeek 的角色不是替代 GTO，而是让 Agent 更像一个可交流、可调风格的玩家。

输入内容：

- Agent 自己的手牌。
- 公共牌。
- 当前阶段、底池、有效筹码、位置。
- 本轮和历史下注动作。
- 合法动作列表。
- GTO 模块建议。
- Agent 风格参数。

输出内容：

```json
{
  "action": "call",
  "amount": 120,
  "confidence": 0.72,
  "reason": "有中等摊牌价值，跟注比加注更稳。"
}
```

安全约束：

- 不给 Agent 其他真人玩家的隐藏手牌。
- 不允许模型返回任意未授权动作。
- 不把 API key 暴露给浏览器。
- 所有动作由服务端二次校验。

## 开发里程碑

### Milestone 1：重构为可扩展游戏引擎

- 抽离牌组、牌型评估、游戏状态和渲染逻辑。
- 增加下注动作状态机。
- 支持完整一手牌流程。
- 增加核心逻辑测试。

验收标准：不依赖 UI，也能用测试脚本跑完一整手牌。

### Milestone 2：本地人与人对战

- 玩家座位管理。
- 当前行动提示。
- 操作面板和下注输入。
- fold/check/call/bet/raise/all-in。
- 摊牌、边池和下一局。

验收标准：2 到 8 人可以在同一浏览器里完整打牌。

### Milestone 3：Agent 基线版本

- 座位支持真人/Agent 切换。
- 实现规则型 GTO baseline。
- Agent 可自动执行合法动作。
- 增加 Agent 行动日志。

验收标准：玩家可以和至少 1 个 Agent 完整打一局。

### Milestone 4：DeepSeek 接入

- 新增后端代理接口。
- 使用环境变量配置 DeepSeek API key 和模型名。
- 将 GTO 建议传给 DeepSeek。
- DeepSeek 返回动作和简短解释。

验收标准：Agent 决策来自 DeepSeek + GTO，且所有动作经过规则校验。

### Milestone 5：在线房间

- 增加服务端牌局状态。
- WebSocket 同步房间状态。
- 支持创建房间、加入房间、座位锁定。
- 支持断线重连。

验收标准：不同浏览器可以加入同一个房间对战。

### Milestone 6：策略与体验增强

- 增加 Agent 风格设置。
- 增加手牌历史回放。
- 增加胜率和牌型提示开关。
- 增加玩家统计：VPIP、PFR、AF、摊牌胜率。
- 增加移动端布局优化。

## 推荐实现顺序

1. 先重构游戏引擎，不急着接 DeepSeek。
2. 先完成本地人与人对战，确保规则闭环。
3. 再做规则型 Agent，让人机对战先跑起来。
4. 接 DeepSeek 后端代理，加入解释和风格。
5. 最后做在线房间和更复杂的 GTO 近似。

## 初始文件规划

```text
src/
  engine/
    deck.js
    handEvaluator.js
    gameState.js
    bettingEngine.js
    rulesValidator.js
  agent/
    gtoBaseline.js
    deepseekAgent.js
    stateEncoder.js
  ui/
    tableView.js
    playerSeat.js
    actionPanel.js
server/
  index.js
  routes/
    agent.js
tests/
  handEvaluator.test.js
  bettingEngine.test.js
  agentPolicy.test.js
```

## 风险与注意事项

- GTO 是长期目标，不应在 MVP 阶段承诺完整求解器。
- DeepSeek 需要后端代理，不能直接在前端调用。
- Agent 不能看到其他玩家隐藏手牌，否则项目失去公平性。
- 德州规则细节很多，尤其是最小加注、all-in、边池，需要优先测试。
- 在线多人对战必须以服务端状态为准，避免客户端作弊或状态漂移。
