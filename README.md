# PokerGame_Agent

自定义德州

一个零依赖的浏览器版德州扑克原型。可以自定义玩家数量、玩家姓名、起始筹码、盲注和庄位，然后自动洗牌、发牌、发公共牌并摊牌结算。

## 功能

- 2 到 8 名玩家
- 自定义起始筹码、小盲、大盲和庄位
- 可指定 Agent 座位
- 自动洗牌、发手牌、发翻牌/转牌/河牌
- 支持 fold、check、call、bet、raise、all-in
- 自动处理行动顺序和四轮下注闭环
- 支持弃牌、all-in、最小加注校验和边池结算
- 庄位和盲注随每局轮转
- 跨多局保留玩家筹码
- 非当前行动玩家手牌默认隐藏
- 前端展示 Agent 决策摘要、GTO 每个合法选择的评分和 DeepSeek 最终动作
- 快捷下注尺度：最小、1/4 池、1/3 池、1/2 池、满池
- Agent 每次行动会接收前序行动路线、历史 AI 决策摘要和 GTO base memory
- 七选五手牌评估，支持高牌到同花顺
- 摊牌后自动分配底池

## 项目计划

后续会继续扩展 DeepSeek 模型 + GTO 策略驱动的人机对战，以及在线房间。详细路线见 [PLAN.md](PLAN.md)，开发任务见 [TODO.md](TODO.md)。

## 使用

直接用浏览器打开 `index.html`。

也可以启动一个简单静态服务：

```bash
node server/index.js
```

然后访问 `http://localhost:5173`。

如需启用 DeepSeek Agent，在本地环境变量中设置 `DEEPSEEK_API_KEY` 后再启动服务。不要把 API key 写入仓库文件。
