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
      return json({
        error: "TCHAVI_API_KEY is missing from Cloudflare secrets."
      }, 500);
    }
    try {
      const form = await request.formData();
      const image = form.get("image");
      if (!image || typeof image.arrayBuffer !== "function") {
        return json({ error: "Please upload a screenshot." }, 400);
      }
      if (image.size > 8 * 1024 * 1024) {
        return json({ error: "Image must be under 8 MB." }, 400);
      }
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
      ];
      if (!allowedTypes.includes(image.type)) {
        return json({
          error: "Only JPG, PNG and WEBP images are supported."
        }, 400);
      }
      const bytes = new Uint8Array(await image.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 32768) {
        binary += String.fromCharCode(
          ...bytes.subarray(i, i + 32768)
        );
      }
      const base64 = btoa(binary);
      const systemPrompt = `
You are SIR TRADES AI, a professional virtual sports odds
analysis assistant.
Carefully examine the uploaded betting screenshot.
SECTION 1: SCREENSHOT EXTRACTION
- Identify every visible fixture and team.
- Extract all readable betting markets.
- Extract every visible odd.
- Never invent missing information.
- Clearly identify anything unreadable.
SECTION 2: ODDS ANALYSIS
For every fixture:
- Calculate raw implied probability using 1 / odds * 100.
- Calculate the total implied probability across the visible
  1X2 outcomes.
- Explain that the excess above 100% represents the
  bookmaker's implied margin.
SECTION 3: TOP 3 SELECTIONS
- Identify the three shortest-priced selections among the
  readable odds.
- Show the fixture, market and exact odds.
- Explain why each has a shorter price.
- Give a descriptive risk rating based on odds only.
- Do not call any selection safe or guaranteed.
SECTION 4: COMBINED ODDS
- Calculate combined odds for the three shortest-priced
  selections by multiplying their odds.
- Show the calculation.
- Explain that combined odds do not guarantee success.
SECTION 5: FINAL SUMMARY
Present the findings clearly and professionally.
IMPORTANT RULES:
- Virtual sports outcomes are random.
- Odds are not proof of the actual probability of winning.
- Shorter odds do not guarantee a result.
- Never promise profits or guaranteed wins.
- Distinguish bookmaker-implied probability from actual
  winning probability.
- If the screenshot is unclear, say so.
- Do not fabricate fixtures, odds or markets.
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
                content: systemPrompt
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Analyse this virtual sports betting screenshot."
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
            max_tokens: 1800,
            temperature: 0.2
          })
        }
      );
      const result = await response.json();
      if (!response.ok) {
        return json({
          error: result.error?.message ||
            "Tchavi API request failed.",
          provider_status: response.status
        }, response.status);
      }
      const analysis =
        result.choices?.[0]?.message?.content;
      if (!analysis) {
        return json({
          error: "The AI returned an empty analysis."
        }, 502);
      }
      return json({ analysis });
    } catch (error) {
      return json({
        error: error.message || "An unexpected error occurred."
      }, 500);
    }
  }
};
