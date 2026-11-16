export default {
  async fetch(request, env) {
    const allowedOrigin = "https://rolix717-code.github.io";
    const headers = {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    };
    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), { status, headers });
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }
    if (request.headers.get("Origin") !== allowedOrigin) {
      return json({ error: "Access denied." }, 403);
    }
    if (request.method !== "POST") {
      return json({ error: "POST requests only." }, 405);
    }
    if (!env.TCHAVI_API_KEY) {
      return json({ error: "API key missing." }, 500);
    }
    try {
      const form = await request.formData();
      const image = form.get("image");
      if (!image || typeof image.arrayBuffer !== "function") {
        return json({ error: "Upload a screenshot first." }, 400);
      }
      if (image.size > 8 * 1024 * 1024) {
        return json({ error: "Image must be under 8 MB." }, 400);
      }
      if (!["image/jpeg", "image/png", "image/webp"].includes(image.type)) {
        return json({ error: "Only JPG, PNG and WEBP are supported." }, 400);
      }
      const bytes = new Uint8Array(await image.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 32768) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
      }
      const base64 = btoa(binary);
      const prompt = `
You are SIR TRADES AI.
Read the uploaded virtual sports betting screenshot.
Your task is to identify exactly TWO selections from TWO DIFFERENT matches.
RULES:
- Compare all readable decimal odds.
- Select the two lowest-priced outcomes.
- Verify the fixture names and odds carefully.
- Never invent odds or fixtures.
- If two valid selections cannot be identified, say "NOT ENOUGH CLEAR DATA".
- Virtual sports outcomes are random.
- Never promise guaranteed winnings.
STRICT OUTPUT:
Return ONLY this format:
🔥 SIR TRADES AI
1. [TEAM A vs TEAM B]
   PICK: [Selection]
   ODDS: [Decimal odds]
2. [TEAM A vs TEAM B]
   PICK: [Selection]
   ODDS: [Decimal odds]
COMBINED ODDS: [Calculated odds]
No explanations.
No probability calculations.
No fixture breakdown.
No additional analysis.
No other selections.
`;
      const response = await fetch(
        "https://tchavi.com/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.TCHAVI_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: prompt
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Return only the two best-priced selections from this screenshot."
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:${image.type};base64,${base64}`
                    }
                  }
                ]
              }
            ],
            max_tokens: 300,
            temperature: 0
          })
        }
      );
      const result = await response.json();
      if (!response.ok) {
        return json({
          error: result.error?.message || "AI request failed."
        }, response.status);
      }
      const analysis = result.choices?.[0]?.message?.content;
      if (!analysis) {
        return json({ error: "No results returned." }, 502);
      }
      return json({ analysis });
    } catch (error) {
      return json({ error: error.message }, 500);
    }
  }
};
