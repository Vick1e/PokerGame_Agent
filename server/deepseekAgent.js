function buildDeepSeekDecisionPayload(snapshot, gtoAction) {
  return {
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    temperature: Number(process.env.DEEPSEEK_TEMPERATURE || 0.2),
    messages: [
      {
        role: "system",
        content:
          "You are a Texas Hold'em poker agent. Use the provided GTO base memory, action route, prior AI decisions, pot geometry, and legal actions. Choose only from the provided legal actions. Never assume hidden opponent cards. Return concise JSON only; do not include hidden chain-of-thought.",
      },
      {
        role: "user",
        content: JSON.stringify({
          table: snapshot,
          gtoBaseMemory: snapshot.gtoBaseMemory,
          actionMemory: snapshot.actionMemory,
          decisionMemory: snapshot.decisionMemory,
          gtoSuggestion: gtoAction,
          responseShape: {
            type: "fold | check | call | betRaise | allIn",
            amount: "number or null",
            confidence: "0..1",
            reason: "short Chinese explanation; do not include hidden chain-of-thought",
          },
        }),
      },
    ],
  };
}

async function requestDeepSeekDecision(snapshot, gtoAction, fetchImpl = fetch) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return { ...gtoAction, source: "gto-baseline", reason: "DEEPSEEK_API_KEY is not configured." };
  }

  const response = await fetchImpl("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildDeepSeekDecisionPayload(snapshot, gtoAction)),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek request failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "{}";
  return parseDecisionContent(content);
}

function parseDecisionContent(content) {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse(fenced ? fenced[1].trim() : trimmed);
}

if (typeof module !== "undefined") {
  module.exports = { buildDeepSeekDecisionPayload, requestDeepSeekDecision, parseDecisionContent };
}
