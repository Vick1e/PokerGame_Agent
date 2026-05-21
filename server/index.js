const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const { chooseGtoBaselineAction } = require("../src/agent/gtoBaseline");
const { validateAgentAction } = require("../src/agent/legalActionValidator");
const { requestDeepSeekDecision } = require("./deepseekAgent");

const rootDir = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 5173);
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/agent/act") {
      await handleAgentAct(req, res);
      return;
    }

    if (req.method !== "GET") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    await serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

async function handleAgentAct(req, res) {
  const snapshot = await readJsonBody(req);
  const legal = snapshot.legalActions;
  const gtoAction = chooseGtoBaselineAction(snapshot);
  let action = gtoAction;
  let source = "gto-baseline";
  let reason = gtoAction.reason || "";

  try {
    const deepseekAction = await requestDeepSeekDecision(snapshot, gtoAction);
    const validation = validateAgentAction(deepseekAction, legal);
    if (validation.ok) {
      action = deepseekAction;
      source = "deepseek";
      reason = deepseekAction.reason || "";
    } else {
      reason = `DeepSeek action rejected: ${validation.reason}`;
    }
  } catch (error) {
    reason = `DeepSeek fallback: ${error.message}`;
  }

  const fallbackValidation = validateAgentAction(action, legal);
  if (!fallbackValidation.ok) {
    action = legal.canCheck ? { type: "check" } : legal.canCall ? { type: "call" } : { type: "fold" };
    source = "rules-fallback";
    reason = fallbackValidation.reason;
  }

  sendJson(res, 200, {
    ...action,
    source,
    reason,
    gtoRecommendation: gtoAction,
    gtoOptions: gtoAction.gtoOptions || [],
  });
}

async function readJsonBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 128_000) {
      throw new Error("Request body too large");
    }
  }
  return JSON.parse(body || "{}");
}

async function serveStatic(req, res) {
  const url = new URL(req.url, "http://localhost");
  const safePath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.normalize(path.join(rootDir, safePath));

  if (!filePath.startsWith(rootDir)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  const content = await fs.readFile(filePath);
  res.writeHead(200, {
    "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  res.end(content);
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

server.listen(port, () => {
  console.log(`PokerGame_Agent running at http://localhost:${port}`);
  console.log(`DeepSeek key loaded: ${process.env.DEEPSEEK_API_KEY ? "yes" : "no"}`);
});
